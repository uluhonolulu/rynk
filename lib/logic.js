'use strict';
/**
 * Voting transaction
 * @param {org.rynk.Vote} voteData
 * @transaction
 */
function Vote(voteData){
  var factory = getFactory();
  var namespace = "org.rynk";
  var currentParticipant = getCurrentParticipant();
  var currentUserId = currentParticipant.getIdentifier();

  //saving the actual vote, so that we could count it and get the results
  var vote = factory.newResource(namespace, 'VotedDecision', "1");
  vote.votedDecision = factory.newRelationship(namespace, 'Decision', voteData.votedDecision.name);
  getAssetRegistry(namespace + '.' + 'VotedDecision').then(function(voteRegistry) {
    voteRegistry.add(vote);
  });

  //add UserVote, so that we could prevent from double voting
  var userVote = factory.newResource(namespace, 'UserVote', currentUserId);
  getAssetRegistry(namespace + '.' + 'UserVote').then(function(voteRegistry) {
    voteRegistry.add(userVote);
  });
}

/**
  * Check whether the current user can vote
  * @param {org.rynk.CanVote} canVoteData
  * @transaction
  */
//TODO: canVote()
