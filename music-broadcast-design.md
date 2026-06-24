Appendix A: Music Broadcast Feature

Summary
This update expands the Intercom at The Yard beyond microphone-based announcements by allowing users to broadcast audio from microphones, virtual audio devices (e.g., BlackHole, Loopback, VB-Cable), and browser-tab or desktop audio sources. No backend services, Raspberry Pi software, or deployment infrastructure were added.

Changes

Audio Source Selection
* Added support for selecting microphone and virtual audio devices.
* Added browser-tab and desktop audio capture using getDisplayMedia().
* Added runtime source switching without requiring a page refresh.

Music Mode
* Added a persistent broadcast mode for music playback.
* Preserved the original push-to-talk behavior for voice announcements.
* Requires at least one destination zone before broadcasting.

Routing Reliability
* Added structured routing messages:

{
  "type": "route",
  "zones": [1,3],
  "active": true
}

* Maintains compatibility with the original zone-array format.
* Resends routing state periodically so newly connected endpoints receive current broadcast information.
* Immediately updates routing when zone selections change.

Audio Quality Changes
* Removed duplicate audio capture paths.
* Corrected audio constraints for music playback.
* Added support for MediaStreamTrack.contentHint to distinguish music from speech.

Architecture Notes
The underlying architecture is unchanged:
* WebRTC full-mesh topology
* p5LiveMedia signaling
* Peer-to-peer audio transport
* Receiver-side zone muting

All peers continue to receive audio streams, where zone routing is done locally by muting or unmuting streams based on routing messages.

Files Modified

File	Purpose
index.html	Audio source controls and status UI
style.css	Styling for new controls and status messages
sketch.js	Audio capture, source switching, music mode, routing updates
README.md	User documentation and setup instructions

Known Limitations for Future Updates
* No authentication or authorization.
* No TURN server or media relay.
* Multiple broadcasters can overlap.
* Browser-tab audio support varies by browser.
* Public-performance licensing remains the responsibility of operators.
* Raspberry Pi endpoints require no changes.
