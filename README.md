GitHub Enterprise Migration Tool
==============

A tool to migrate issues and pull requests from one GitHub repo to another. I used the scripts in this repository to 
transfer all of our pull requests, issues, review comments, issues comment and commit comments frm repositories on GitHub
to in-house GitHub Enterprise repositories.

There are two scripts that I used:

fetchIssues.js (pulls issues/pull requests and all comments from source)
pushIssues.js (pushes everything to the destination repo)

Here's how I did it.

1. Do a ```git clone sourcerepo --mirror```
2. run sed -i.bak s/pull/pr/g <your repo>.git/packed-refs
3. Do a ```git push destrepo --mirror```
