'use strict';
/**
 * Voting transaction
 * @param {org.rynk.Vote} voteData
 * @transaction
 */
async function Vote(voteData){
  var factory = getFactory();
  var namespace = "org.rynk";
  var currentParticipant = getCurrentParticipant();
  var currentUserId = currentParticipant.$identifier;
  let choiceName = voteData.votedChoice.name

  //check if the user has voted or not
  let voteRegistry = await getAssetRegistry(namespace + '.' + 'Ballot');
  let voteExists = await voteRegistry.exists(currentUserId);

  //get the existing vote or create a new one
  let vote = voteExists? await voteRegistry.get(currentUserId) : await factory.newResource(namespace, 'Ballot', currentUserId); 

  //if the vote existed, save its old choice
  let oldChoice = voteExists? vote.votedChoice.$identifier : null;
  

  //set the properties
  vote.votedChoice = factory.newRelationship(namespace, 'Choice', choiceName);
  vote.user = factory.newRelationship(namespace, 'User', currentUserId);
  vote.when = voteData.when;

  //save
  if (voteExists) {
    await voteRegistry.update(vote);
  } else {
    await voteRegistry.add(vote);    
  }

  //update the stats if the new vote is different from the old one
  if (choiceName !== oldChoice) {

    voteRegistry = await getAssetRegistry(namespace + '.' + 'VoteTotal');

    //if votecount exists, increment, else, add
    let exists = await voteRegistry.exists(choiceName);
    if(exists){
      let total = await voteRegistry.get(choiceName); 
      total.count += 1;
      await voteRegistry.update(total);
    } else {
      let total = factory.newResource(namespace, 'VoteTotal', choiceName);
      total.votedChoice = factory.newRelationship(namespace, 'Choice', choiceName);
      total.count = 1;
      await voteRegistry.add(total);
    }


    //if there was an old vote, we should substract it
    if (voteExists) {
      let total = await voteRegistry.get(oldChoice);
      total.count -= 1;
      await voteRegistry.update(total);    
    }

        
  }

}

function getUserId(){
  var currentParticipant = getCurrentParticipant();
  return currentParticipant.$identifier;
}
