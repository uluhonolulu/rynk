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

const choiceName = "Dobro";


describe('#' + namespace, async () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = new MemoryCardStore();
    let adminConnection;
    let businessNetworkConnection;
    let factory;

    before( async() => {
        //console.log("Global Before");
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
        // let definition = await BusinessNetworkDefinition.fromDirectory(__dirname + '/..');
        // await adminConnection.update(definition);

                //DEBUG
                // var pouchdbDebug = require('pouchdb-debug');
                // var PouchDB = require('pouchdb-core');
                // PouchDB.plugin(pouchdbDebug);
                // //PouchDB.debug.enable('*');
    });

    beforeEach(async () => {
        //console.log("Global BeforeEach");
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

        //create a Choice
        await createChoice();
    });

    describe('Initially', async () => {
      xit('should be zero votes', async () => {
        let voteRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + 'VotedChoice');
        let votes = await voteRegistry.getAll();
        votes.length.should.equal(0);
      });

      it('CanVote() returns true', async () => {
        let transaction = factory.newTransaction(namespace, "CanVote");
        let dummy = factory.newConcept(namespace, "CanVoteInput");
        transaction.input = dummy;

        let result = await getTransactionResult(transaction, "org.rynk.CanVoteResult");
        result.should.be.true;
      });

      describe ('If there is a Choice', async () => {
        // before(async () => {
        // });

        it('it is present in vote results, and the vote count is 0', async () => {
          let voteResults = await getVoteResults();
          voteResults.length.should.equal(1);
          let vote = voteResults[0];
          vote.choiceName.should.equal(choiceName);
          vote.count.should.equal(0);
        });
      });
    });

    async function getTransactionResult(transaction, expectedEvent){
      return new Promise(async (resolve, reject) => {
        businessNetworkConnection.on('event',(event)=>{
          var eventType = event.$namespace + '.' + event.$type;
          console.log(eventType);
          if (eventType === expectedEvent) {
            if (event.error) {
              reject(event.error);
            } else {
              resolve(event.result);
            }

          }
        });

        await businessNetworkConnection.submitTransaction(transaction);
      });
    }

    async function createChoice() {
        let choice = factory.newResource(namespace, 'Choice', choiceName);
        let registry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + 'Choice');
        await registry.add(choice);

        // console.log("Counting choices");
        // let choices = await registry.getAll();
        // console.log(choices.length);
    }

    async function getVoteResults() {
      let transaction = factory.newTransaction(namespace, 'GetVoteResults');
      let dummy = factory.newConcept(namespace, "CanVoteInput");
      transaction.input = dummy;
      let result = await getTransactionResult(transaction, "org.rynk.GetVoteResultsResult");
      return result;
    }

    describe('Voting for the first time', async () => {

      beforeEach(async () => {


        //Vote transaction
        console.log("Voting..");
        const voteData = factory.newTransaction(namespace, 'Vote');
        voteData.votedChoice = factory.newRelationship(namespace, 'Choice', choiceName);
        await businessNetworkConnection.submitTransaction(voteData);

        // let vote = factory.newResource(namespace, 'SubmittedVote', "1");
        // vote.submittedChoice = factory.newRelationship(namespace, 'Choice', Choice.$identifier);
        // let voteRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + 'SubmittedVote');
        // await voteRegistry.add(vote);
      });

      it('should be one vote in the registry for Our President', async () => {
        console.log("Counting..");
        let voteRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + 'VotedChoice');
        let votes = await voteRegistry.getAll();
        votes.length.should.equal(1);
        votes[0].votedChoice.$identifier.should.equal(choiceName);
      });

      it('should be one vote in the Vote Results for Our President', async () => {
        let voteResults = await getVoteResults();
        let vote = voteResults[0];
        vote.choiceName.should.equal(choiceName);
        vote.count.should.equal(1);
      });

      xit('shouldn\'t be able to vote again', async () => {

      });
    });


});
