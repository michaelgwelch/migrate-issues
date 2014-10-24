GitHub Enterprise Migration Tool
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
1. Go to the bottom of fetchIssues.js where you see getIssues, getComments and anchorCommits. Comment out the line about anchor commits. Now run it ```node fetchIssues.js repoName```
