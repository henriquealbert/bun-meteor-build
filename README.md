## Issue while trying to install packages using `bun install` in Meteor build

Steps to reproduce:
```bash
$ meteor build --directory ./dist
$ cd dist/bundle/programs/server
$ bun install


error: MissingPackageJSON
Bun could not find a package.json file.
```