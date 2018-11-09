cognicity-reports-powertrack-outreach
=====================================

Concept
-------

- Use Cognicity PowerTrack to filter Twitter firehose in real-time based on keyword and location
- Trigger automated response to users using the public Twitter API based on matching first conditions


- Flow:

For a particular country, PowerTrack matches based on keyword and target geography.
Reply messages contain a "Send Report via DM" button.

- Needs:

config.js file with:
    - PowerTrack specific configuration
    - app specific configuration

- Geography:

PowerTrack limited to 25 square mile grids, need a utility to generate these from arbitary input bounding box.

Send a DM
https://business.twitter.com/en/help/campaign-editing-and-optimization/public-to-private-conversation.html