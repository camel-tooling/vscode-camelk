# How to release

- Create a tag and push it
- Start build [on Jenkins CI](https://dev-platform-jenkins.rhev-ci-vms.eng.rdu2.redhat.com/view/VS%20Code/job/vscode-camelk-release/) with _publishToMarketPlace_ parameter checked
- When the build is waiting on step _Publish to Marketplace_, go to the console log of the build and click "Approve"
- Wait few minutes and check that it has been published on [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-camelk)
- Keep build forever for later reference and edit build information to indicate the version
- Update package.json and Changelog.md with next version to prepare for new iteration release (via a Pull Request)