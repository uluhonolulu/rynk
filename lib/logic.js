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

  //saving the actual vote, so that we could count it and get the results
  var vote = factory.newResource(namespace, 'VotedChoice', voteData.uuid); 
  vote.votedChoice = factory.newRelationship(namespace, 'Choice', choiceName);
  let voteRegistry = await getAssetRegistry(namespace + '.' + 'VotedChoice');
  await voteRegistry.add(vote);

  var voter = factory.newResource(namespace, 'VotedUser', currentUserId);
  voteRegistry = await getAssetRegistry(namespace + '.' + 'VotedUser');
  await voteRegistry.add(voter);

  //quick and dirty
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

  
}

/**
  * Check whether the current user can vote
  * @param {org.rynk.CanVote} canVoteData
  * @transaction
  */
async function CanVote(canVoteData) {
  // throw new Error("Can't vote twice, sorry!");
  var namespace = "org.rynk";
  var factory = getFactory();
  var q = buildQuery("SELECT " + namespace + '.' + 'VotedUser WHERE (userName == _$userName)');
  let voted = await query(q, { userName: getUserId() });
  //if the user has voted already, lt's just throw an error
  let canVote = (voted.length == 0);
  if (!canVote) {
    throw new Error("Can't vote twice, sorry!")
  }

}


function getUserId(){
  var currentParticipant = getCurrentParticipant();
  return currentParticipant.$identifier;
}
