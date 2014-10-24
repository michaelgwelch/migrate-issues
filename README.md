GitHub Enterprise Migration Scripts
==============

A tool to migrate issues and pull requests from one GitHub repo to another. I used the scripts in this repository to 
transfer all of our pull requests, issues, review comments, issues comment and commit comments frm repositories on GitHub
to in-house GitHub Enterprise repositories.

There are two scripts that I used:

fetchIssues.js (pulls issues/pull requests and all comments from source)
pushIssues.js (pushes everything to the destination repo)

Here's how I did it.

Move Repo
-----

1. Do a ```git clone sourcerepo --mirror```
2. run sed -i.bak s/pull/pr/g <your repo>.git/packed-refs
3. Do a ```git push destrepo --mirror```

Note step #2 is important in that you can not push up any refs in refs/pull. These are considered "hidden" refs by GitHub
and won't get pushed. But by renaming them to pr you will have useful "hidden" branches on your destination repo. These
will come in handy when creating pull requests which require a "base" ref and a "head" ref. The "head" refs are already
in your repo, created by GitHub for every pull request you ever did.

Move Everything Else
--------

0. Open fetchIssues and modify the source info at the top of the script.
1. Go to the bottom of fetchIssues.js where you see getIssues, getComments and anchorCommits. Comment out the line about anchor commits. Now run it ```node fetchIssues.js repoName``` (There will now be a new subdirectory in your working directory named after your repo. It'll contain all issues (and pull requests) and all comments).
2. (An aside. Your mirrored repository may be missing many (many) "orphaned" commits that are reference by pull requests, review comments and commit comments. The next step will identify all of the commits that are referenced but that don't exist in your destination repository. We will then try to "adopt" them. In other words we can still try to create refs to them in the original source repository so that we can clone the source a second time, this time containing the "orphaned" commits.)
3. Open pushIssues.js and modify the dest info at the top of the script
4. Go to the bottom of pushIssues.js and comment out all of the tasks except "checkPulls" and "checkCommits". Now run it ```node pushIssues.js repoName```. All this is going to do is spit out commits that are referenced but that don't exist in the destination repository. If you don't see any commits then you are in good shape. Skip the next steps and meet me at #???. Otherwise go to the next step.
5. In the previous step the orphaned commits were written to repoName/missingCommits.json. Some of these commits may actually still be in the source repo (some may not and there is not much we can do about those). Open fetchIssues.js and go to bottom. Now comment out getIssues and getComments and uncomment anchorCommits. Now run it ```node fetchIssues.js repoName```. This now attempts to create a ref (a branch) for each missing commit. You may see some or many failed attempts. Those commits are truly gone. When this step finishes, you will have "anchored" all of the commits that still exist and are referenced.
6. Now go back to the first part of these steps and reclone and repush. The new clone will contain all of the newly anchored commits and they will then make it into your destination repo
7. Now we are ready to start the creation process. Open pushIssues and comment out all tasks but createBranches and run it. This step creates a branch called pr#base for each pull request. There already exists hidden refs named pr/#/head for each pull reqeust (where in both cases # is the pull number).
8. Now rerun with just pushIssues uncommented. This will push all of your issues up and in the case of an issue that is a pull request it will create a pull request. To create a pull request 4 pieces of info are needed: title, body, head branch, base branch. We already have all the branches created so each issue should be created successfully. Note: I did run into issues on this step (See below for what can go wrong creating a pull request).
9. Now that all the issues exist we can start adding comments. Note all non-pr issue comments will be created without problem. Some review comments will be for a commit that is no longer part of the pull reqeust (again this can happen if someone did a push -f after the pull was created). In this case I go ahead and put the comment on the original commit and in the body of the comment I add a #prnumber to link it back to the pull request. That way when you look at teh pull request there will be some indication taht more comments exist. Finally, any commit comment could fail if the original commit was garbage collected from the source repo already. Nothing you can do about this. A failure comment is written to stdout informing you.
10. Now that all issues and comments exist you can "update" your issues. In particular if they are closed you want to mark them closed now. I also add a label "GitHub Import" (talk about how you create that during the creating step of the destination rep). Open pushIssues again and uncomment everything put the updateIssues step.
11. Now that's left is a "cleanup" step. My scripts will have polluted your public branch namespace with branches named pr#base. Uncomment out the fetchBranches and deleteBranches steps and rerun. This will clean up your public branches namespace. (I attempted on several occasions to make the pr#base refs show up in refs/pr/#/base just like the head branches. And I can do that. But the create pull request api fails validation when attempt to create a pull request that has a hidden base ref. The head apparently can be hidden and that's no problem




What can go wrong creating pull reqeust
---------
1. Network issues, or slow server causes a timeout and the script aborts. I manually restarted and added conidtionals in pushIssues to skip all of the issues less than the next one to create. (say more)
2. The difference between the head and base is nothing (or head and base point to same sha). Both of these scenarios could happen if after the original pull request was created someone did a ```push -f``` to either side. If there are no commits of difference between head and base the pull request will fail to be created. I have some logic in the script to just try to create a dummy PR anyway, but it doesn't always work. In particular it only handles the case where head and base are identical because it's the only thing it can detect ahead of time. If you get an abort here, manually create a dummy pull request for this pull #. Why? You need to keep pull request #'s identical as they were before since the pull # is linked automatically. You don't want links to pull #3 actually linking to the wrong pull (explain better).

What can go wrong with comments
--------
Network or server issues could cause the script to fail. Look at the number of the last commment to get created. Modify the script to skip all the comments up to that number and restart. (Likewise, you could modify the scripts so that they journal how much work has been succesfully completed so that on restart they pick up where they left off automatically)

What can go wrong with Update Issues
-------
I saw that not all issues got labelled. Rerunning the script several times dooesn't hurt. I do modify it so as to not send the 'closed' state multiple times. Just comment out the state property. Then only the labelling happens.

What can go wrong with deletes
---------
I guess it could fail like the others. rerun as many times as needed until all the pr#base branches are gone.
