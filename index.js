'use strict';

require('dotenv').config() // for local dev
const { Agent } = require('node-agent-sdk');

const agent = new Agent({
  accountId: process.env.LP_ACCOUNT,
  username: process.env.LP_USER,
  appKey: process.env.LP_APP_KEY,
  secret: process.env.LP_SECRET,
  accessToken: process.env.LP_ACCESS_TOKEN,
  accessTokenSecret: process.env.LP_TOKEN_SECRET
});
console.log(agent)
let openConvs = {};

agent.on('connected', () => {
  console.log('connected...');
  agent.setAgentState({ availability: 'AWAY' }); // Do not route me conversations, I'll join by myself.
  agent.subscribeExConversations({
    'convState': ['OPEN'] // subscribes to all open conversation in the account.
  });
});

agent.on('cqm.ExConversationChangeNotification', notificationBody => {
  notificationBody.changes.forEach(change => {
    if (change.type === 'UPSERT') {
      if (!openConvs[change.result.convId]) {
        openConvs[change.result.convId] = change.result;
        if (!getParticipantInfo(change.result.conversationDetails, agent.agentId)) {
          agent.updateConversationField({
            'conversationId': change.result.convId,
            'conversationField': [{
              'field': 'ParticipantsChange',
              'type': 'ADD',
              'role': 'MANAGER'
            }]
          }, () => {
            agent.updateConversationField({
              'conversationId': change.result.convId,
              'conversationField': [{
                'field': 'ConversationStateField',
                'conversationState': 'CLOSE'
              }]
            });
          });
        }
      }
    }
    else if (change.type === 'DELETE') {
      delete openConvs[change.result.convId];
      console.log('conversation was closed.\n');
    }
  });
});

agent.on('error', err => {
  console.log('got an error', err);
});

agent.on('closed', data => {
  console.log('socket closed', data);
  agent.reconnect();//regenerate token for reasons of authorization (data === 4401 || data === 4407)
});

function getParticipantInfo(convDetails, participantId) {
  return convDetails.participants.filter(p => p.id === participantId)[0];
}