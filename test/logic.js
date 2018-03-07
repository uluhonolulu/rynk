'use strict';
/**
 * Write the unit tests for your transction processor functions here
 */

// const AdminConnection = require('composer-admin').AdminConnection;
// const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
// const BusinessNetworkDefinition = require('composer-common').BusinessNetworkDefinition;
// const IdCard = require('composer-common').IdCard;
// const MemoryCardStore = require('composer-common').MemoryCardStore;
const { AdminConnection, BusinessNetworkConnection, BusinessNetworkDefinition, IdCard, MemoryCardStore } = require('./setup.js');
const Util = require('composer-common').Util;

const path = require('path');

require('chai').should();

const namespace = 'org.rynk';
const assetType = 'SampleAsset';

describe('#' + namespace, async () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = new MemoryCardStore();
    let adminConnection;
    let businessNetworkConnection;
    let factory;

    before( async() => {
        // Embedded connection used for local testing
        const connectionProfile = {
            name: 'embedded',
            type: 'embedded'
        };
        // Embedded connection does not need real credentials
        const credentials = {
            certificate: 'FAKE CERTIFICATE',
            privateKey: 'FAKE PRIVATE KEY'
        };

        // PeerAdmin identity used with the admin connection to deploy business networks
        const deployerMetadata = {
            version: 1,
            userName: 'PeerAdmin',
            roles: [ 'PeerAdmin', 'ChannelAdmin' ]
        };
        const deployerCard = new IdCard(deployerMetadata, connectionProfile);
        deployerCard.setCredentials(credentials);

        const deployerCardName = 'PeerAdmin';
        adminConnection = new AdminConnection({ cardStore: cardStore });

        await adminConnection.importCard(deployerCardName, deployerCard);
        await adminConnection.connect(deployerCardName);
    });

    beforeEach(async () => {
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });

        const adminUserName = 'admin';
        let adminCardName;
        let businessNetworkDefinition;

        businessNetworkDefinition = await BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));
            // Install the Composer runtime for the new business network
        await adminConnection.install(businessNetworkDefinition.getName());
        // Start the business network and configure an network admin identity
        const startOptions = {
            networkAdmins: [
                {
                    userName: adminUserName,
                    enrollmentSecret: 'adminpw'
                }
            ]
        };
        let adminCards = await adminConnection.start(businessNetworkDefinition, startOptions);

        // Import the network admin identity for us to use
        adminCardName = `${adminUserName}@${businessNetworkDefinition.getName()}`;
        await adminConnection.importCard(adminCardName, adminCards.get(adminUserName));

        // Connect to the business network using the network admin identity
        await businessNetworkConnection.connect(adminCardName);

        factory = businessNetworkConnection.getBusinessNetwork().getFactory();
    });

    describe('Initially', async () => {
      it('should be zero votes', async () => {
        let voteRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + 'VotedDecision');
        let votes = await voteRegistry.getAll();
        votes.length.should.equal(0);
      });

      it('CanVote() returns true', async () => {
        let transaction = factory.newTransaction(namespace, "CanVote");
        let dummy = factory.newConcept(namespace, "CanVoteInput");
        transaction.input = dummy;

        let result = await waitForEvent();
        result.should.be.true;

        async function waitForEvent(){
          return new Promise(async resolve => {
            businessNetworkConnection.on('event',(event)=>{
              var eventType = event.$namespace + '.' + event.$type;
              if (eventType === "org.rynk.CanVoteResult") {
                resolve(event.result);
              }
            });

            await businessNetworkConnection.submitTransaction(transaction);
          })
        }
        // result.should.be.true;

      })
    });

    describe('Voting for the first time', async () => {
      let decision;
      before(async () => {
        // Create a user participant
        const user = factory.newResource(namespace, 'User', 'Artem Smirnov');
        // Create a Decision
        decision = factory.newResource(namespace, 'Decision', "Ulu Honolulu");
        let decisionRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + 'Decision');
        await decisionRegistry.add(decision);

      });
      beforeEach(async () => {

        const voteData = factory.newTransaction(namespace, 'Vote');
        voteData.votedDecision = factory.newRelationship(namespace, 'Decision', decision.$identifier);
        await businessNetworkConnection.submitTransaction(voteData);


        // let vote = factory.newResource(namespace, 'SubmittedVote', "1");
        // vote.submittedDecision = factory.newRelationship(namespace, 'Decision', decision.$identifier);
        // let voteRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + 'SubmittedVote');
        // await voteRegistry.add(vote);
      });

      it('should be one vote for Our President', async () => {
        let voteRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + 'VotedDecision');
        let votes = await voteRegistry.getAll();
        votes.length.should.equal(1);
        votes[0].votedDecision.$identifier.should.equal("Ulu Honolulu");
      });

      xit('shouldn\'t be able to vote again', async () => {

      });
    });


});
