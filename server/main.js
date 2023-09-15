import { Meteor } from "meteor/meteor";

Meteor.startup(async () => {
  console.log("hello Meteor");
  console.log(Bun.version);
});
