# How to provide a new version on VS Code Marketplace

* Check that the version in package.json has not been published yet
  * If already published:
    * Upgrade the version in package.json
    * Run 'npm install' so that the package-lock.json is updated
    * Push changes in a PR
    * Wait for PR to be merged
* Check that someone listed as _submitter_ in Jenkinsfile is available
* Start build on [Jenkins CI](https://studio-jenkins-csb-codeready.apps.ocp-c1.prod.psi.redhat.com/job/Fuse/job/VSCode/job/vscode-camelk-release/) with _publishToMarketPlace_ parameter checked
* Wait the build is waiting on step _Publish to Marketplace_
* Ensure you are logged in
* Go to the console log of the build and click "Proceed"
* Wait few minutes and check that it has been published on [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-camelk)
* Keep build forever for later reference and edit build information to indicate the version
* Create a tag
* Push the tag to vscode-camelk repository
* Prepare next iteration:
  * Upgrade the version in package.json
  * Run 'npm install' so that the package-lock.json is updated
  * Push changes in a PR
  * Follow PR until it is approved/merged

# Note about test execution and GitHub API access

Access to GitHub API has a rate limit. This rate limit is lower for unauthenticated requests. On CI, this rate limit was often hit (either Circle CI or Jenkins). To avoid that, a GitHub token needs to be provided through VSCODE_CAMELK_GITHUB_TOKEN environment variable. This token doesn't require any specific rights.
