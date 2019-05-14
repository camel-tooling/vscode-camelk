# Installing MiniKube and Camel-K

Before using this VS Code extension, both [Minikube](https://kubernetes.io/docs/setup/minikube/) and [Camel-K](https://github.com/apache/camel-k) must be installed on the local machine.

* To install Minikube, follow the directions [here](https://github.com/apache/camel-k/blob/master/docs/cluster-setup.adoc). [This link](https://kubernetes.io/docs/tasks/tools/install-minikube/) is also very helpful.
* To install Camel-K, grab the latest release (such as [0.3.3](https://github.com/apache/camel-k/releases/tag/0.3.3), copy it into a folder on the machine, and make that folder accessible on the system path.
* We then recommend creating a local file - start.sh. The source for start.sh is [here](https://github.com/apache/camel-k/blob/master/docs/cluster-setup.adoc). We recommend adding " -v5" to the end of the last line of start.sh to enable a bit more logging.

Once Minikube and Came-K are installed, follow these steps.

## Steps (With minikube and kamel installed on system)

1. Execute `./start.sh` to start your local Minikube instance.
2. Run `kamel install --cluster-setup`
3. Run `kamel install`
4. Run `minikube addons enable registry` (If "registry" pod doesn't show up when you do the next step, note registry issue we hit below with the resolution.)
5. Run `kubectl get pods --all-namespaces` (to get the id for the camel-k-operator and make sure all pods are running)

### Issue enabling registry addon

Update: Looks like this has been fixed upstream for a later version of Minikube, but still exists with version 1.0.1.

If step 4 above fails to enable the registry, there is a workaround to get things working properly. The script that runs to enable the registry can be found [here](https://github.com/kubernetes/minikube/blob/master/deploy/addons/registry/registry-rc.yaml.tmpl#L28). 

Make a local copy and, on line 28, true needs to be “true”. The double quotes are missing.

You can fix this problem locally to get past it. Download the file, make the fix, and enable the registry component by running `kubectl -n kube-system create -f my-modified-registry.yaml`
