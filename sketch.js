const INTERCOM_ROOM = import.meta.env.VITE_INTERCOM_ROOM || "yard-intercom";

function disableImgDragging() {
  const images = document.getElementsByTagName("img");
  for (const image of images) {
    image.classList.add("no-drag");
    image.setAttribute("no-drag", "on");
    image.setAttribute("draggable", "false");
    image.addEventListener("dragstart", (event) => event.preventDefault(), false);
  }
}

disableImgDragging();

let localStream = null;
let p5lm = null;
let otherAudios = {};
let peerRoutes = {};
let audible = [];
let thisZone = 0;
let isTalking = false;
let routingHeartbeat = null;
let sourceReadyMessage = "Audio source ready.";
const observedLocalTracks = new WeakSet();

const muteButton = document.getElementById("mute");
const talkHeading = document.getElementById("talkHeading");
const talkModeHint = document.getElementById("talkModeHint");
const zoneForm = document.querySelector("#zoneForm");
const zoneOptions = document.querySelectorAll(".zone-option");
const selectedZoneInput = document.querySelector("#selectedZone");
const audioSourceForm = document.querySelector("#audioSourceForm");
const audioSourceType = document.querySelector("#audioSourceType");
const audioInputDevice = document.querySelector("#audioInputDevice");
const inputDeviceGroup = document.querySelector("#inputDeviceGroup");
const refreshDevicesButton = document.querySelector("#refreshDevices");
const continuousMode = document.querySelector("#continuousMode");
const audioSourceStatus = document.querySelector("#audioSourceStatus");

window.setup = function setup() {
  noCanvas();
  startDefaultMicrophone();
};

async function startDefaultMicrophone() {
  setSourceStatus("Requesting the default microphone...");

  try {
    const stream = await acquireAudioInput("");
    await useLocalStream(stream, "Default microphone connected.");
    await refreshAudioInputs();
  } catch (error) {
    console.warn("No microphone found or permission denied:", error);
    initializePeerRoom(null);
    setSourceStatus("Listener only. Open settings to choose an audio source.", true);
  }
}

function audioConstraints(deviceId = "") {
  const audio = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    latency: { ideal: 0.01 },
    channelCount: { ideal: 2 },
    sampleRate: { ideal: 48000 }
  };

  if (deviceId) {
    audio.deviceId = { exact: deviceId };
  }

  return { audio, video: false };
}

async function acquireAudioInput(deviceId) {
  return navigator.mediaDevices.getUserMedia(audioConstraints(deviceId));
}

async function acquireDisplayAudio() {
  if (!navigator.mediaDevices.getDisplayMedia) {
    throw new Error("This browser does not support tab or desktop audio capture.");
  }

  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
    systemAudio: "include",
    surfaceSwitching: "include"
  });
  const audioTracks = displayStream.getAudioTracks();

  if (audioTracks.length === 0) {
    displayStream.getTracks().forEach((track) => track.stop());
    throw new Error("No audio was shared. Select a browser tab or enable Share audio.");
  }

  displayStream.getVideoTracks().forEach((track) => track.stop());
  return new MediaStream(audioTracks);
}

async function useLocalStream(stream, statusMessage) {
  toggleOff();
  const previousStream = localStream;

  shutdownPeerRoom();
  localStream = stream;
  configureAudioTracks(localStream);
  setOutgoingEnabled(false);
  initializePeerRoom(localStream);

  if (previousStream && previousStream !== localStream) {
    previousStream.getTracks().forEach((track) => track.stop());
  }

  sourceReadyMessage = statusMessage;
  setSourceStatus(statusMessage);
}

function configureAudioTracks(stream) {
  if (!stream) return;

  for (const track of stream.getAudioTracks()) {
    if ("contentHint" in track) {
      track.contentHint = continuousMode.checked ? "music" : "speech";
    }
    if (!observedLocalTracks.has(track)) {
      observedLocalTracks.add(track);
      track.addEventListener("ended", handleLocalSourceEnded, { once: true });
    }
  }
}

function handleLocalSourceEnded(event) {
  if (!localStream?.getAudioTracks().includes(event.target)) return;
  toggleOff();
  setSourceStatus("The selected audio source ended. Choose a source to reconnect.", true);
}

function initializePeerRoom(stream) {
  const mode = stream ? "CAPTURE" : "LISTENER";
  p5lm = new p5LiveMedia(window, mode, stream, INTERCOM_ROOM);
  p5lm.on("stream", gotStream);
  p5lm.on("data", gotData);
  p5lm.on("disconnect", gotDisconnect);
  console.log(`Initialized p5LiveMedia in ${mode} mode.`);
}

function shutdownPeerRoom() {
  if (!p5lm) return;

  if (Array.isArray(p5lm.simplepeers)) {
    for (const wrapper of p5lm.simplepeers) {
      wrapper?.simplepeer?.destroy();
    }
  }
  p5lm.socket?.disconnect();
  p5lm = null;

  for (const audio of Object.values(otherAudios)) {
    audio.remove();
  }
  otherAudios = {};
  peerRoutes = {};
}

function gotStream(stream, id) {
  console.log("Got stream from peer:", id);
  otherAudios[id] = stream;
  otherAudios[id].elt.muted = true;
  otherAudios[id].elt.volume = 1.0;
  otherAudios[id].elt.setAttribute("playsinline", "");
  otherAudios[id].hide();
  applyPeerRoute(id);
}

function gotDisconnect(id) {
  if (otherAudios[id]) {
    otherAudios[id].remove();
    delete otherAudios[id];
  }
  delete peerRoutes[id];
}

function setOutgoingEnabled(enabled) {
  if (!localStream) return;
  localStream.getAudioTracks().forEach((track) => {
    track.enabled = enabled;
  });
}

function sendRoutingState() {
  if (!p5lm) return;
  const zones = isTalking ? audible : [];
  p5lm.send(JSON.stringify({ type: "route", zones, active: isTalking }));
}

function toggleOn() {
  if (isTalking) return;
  if (!localStream || localStream.getAudioTracks().length === 0) {
    setSourceStatus("Choose and connect an audio source before broadcasting.", true);
    return;
  }
  if (audible.length === 0) {
    setSourceStatus("Select at least one destination zone before broadcasting.", true);
    return;
  }

  console.log("Broadcasting to zones:", audible);
  isTalking = true;
  setOutgoingEnabled(true);
  muteButton.classList.add("zoneActive");
  muteButton.setAttribute("aria-pressed", "true");
  const destinations = audible.includes(0)
    ? "all zones"
    : `zone${audible.length === 1 ? "" : "s"} ${audible.join(", ")}`;
  setSourceStatus(`Broadcasting to ${destinations}.`);
  sendRoutingState();

  clearInterval(routingHeartbeat);
  routingHeartbeat = window.setInterval(sendRoutingState, 1500);
}

function toggleOff() {
  if (!isTalking) {
    setOutgoingEnabled(false);
    return;
  }

  console.log("Broadcast stopped");
  isTalking = false;
  setOutgoingEnabled(false);
  muteButton.classList.remove("zoneActive");
  muteButton.setAttribute("aria-pressed", "false");
  clearInterval(routingHeartbeat);
  routingHeartbeat = null;
  sendRoutingState();
  setSourceStatus(sourceReadyMessage);
}

function handleTalkStart(event) {
  event.preventDefault();
  if (continuousMode.checked) {
    if (isTalking) toggleOff();
    else toggleOn();
  } else {
    toggleOn();
  }
}

function handleTalkEnd() {
  if (!continuousMode.checked) toggleOff();
}

muteButton.addEventListener("pointerdown", handleTalkStart);
muteButton.addEventListener("pointerup", handleTalkEnd);
muteButton.addEventListener("pointerleave", handleTalkEnd);
muteButton.addEventListener("pointercancel", handleTalkEnd);

muteButton.addEventListener("keydown", (event) => {
  if (!event.repeat && (event.key === "Enter" || event.key === " ")) handleTalkStart(event);
});
muteButton.addEventListener("keyup", (event) => {
  if (event.key === "Enter" || event.key === " ") handleTalkEnd();
});

window.addEventListener("pointerup", handleTalkEnd);
window.addEventListener("pointercancel", handleTalkEnd);

window.config = function config() {
  const configPanel = document.querySelector("#config");
  configPanel.classList.toggle("isOpen");
  if (configPanel.classList.contains("isOpen")) refreshAudioInputs();
};

zoneOptions.forEach((option) => {
  option.addEventListener("click", function selectEndpointZone() {
    selectedZoneInput.value = this.dataset.zone;
    zoneOptions.forEach((button) => button.classList.remove("zoneActive"));
    this.classList.add("zoneActive");
  });
});

zoneForm.addEventListener("submit", (event) => {
  event.preventDefault();
  thisZone = Number.parseInt(selectedZoneInput.value, 10) || 0;
  console.log("thisZone is now", thisZone);
  document.querySelector("#config").classList.remove("isOpen");
});

window.zoneFunction = function zoneFunction(zone) {
  const zoneButton = document.querySelector(`.zone_${zone}_button`);
  const isActive = zoneButton.classList.toggle("zoneActive");

  if (isActive && !audible.includes(zone)) {
    audible.push(zone);
  } else if (!isActive) {
    audible = audible.filter((selectedZone) => selectedZone !== zone);
  }

  console.log("audible zones:", audible);
  if (isTalking) sendRoutingState();
};

function gotData(data, id) {
  try {
    const dataObject = JSON.parse(data);
    const zones = Array.isArray(dataObject) ? dataObject : dataObject.zones;
    if (!Array.isArray(zones)) return;

    peerRoutes[id] = zones;
    applyPeerRoute(id);
  } catch (error) {
    console.error("Error parsing peer data:", error);
  }
}

function applyPeerRoute(id) {
  const audio = otherAudios[id];
  const zones = peerRoutes[id];
  if (!audio || !Array.isArray(zones)) return;

  const shouldPlay = zones.includes(thisZone) || zones.includes(0);
  audio.elt.muted = !shouldPlay;
  if (shouldPlay) {
    audio.elt.play().catch((error) => {
      console.warn("Browser blocked endpoint audio playback:", error);
    });
  }
}

async function refreshAudioInputs() {
  if (!navigator.mediaDevices?.enumerateDevices) return;

  try {
    const selectedDevice = audioInputDevice.value;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((device) => device.kind === "audioinput");

    audioInputDevice.replaceChildren(new Option("Default audio input", ""));
    inputs.forEach((device, index) => {
      const label = device.label || `Audio input ${index + 1}`;
      audioInputDevice.add(new Option(label, device.deviceId));
    });

    if ([...audioInputDevice.options].some((option) => option.value === selectedDevice)) {
      audioInputDevice.value = selectedDevice;
    }
  } catch (error) {
    setSourceStatus(`Could not list audio inputs: ${error.message}`, true);
  }
}

audioSourceType.addEventListener("change", () => {
  const isDisplayCapture = audioSourceType.value === "display";
  inputDeviceGroup.hidden = isDisplayCapture;
  if (isDisplayCapture) continuousMode.checked = true;
  updateTalkMode();
});

continuousMode.addEventListener("change", () => {
  if (isTalking) toggleOff();
  configureAudioTracks(localStream);
  updateTalkMode();
});

refreshDevicesButton.addEventListener("click", refreshAudioInputs);

audioSourceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = audioSourceForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  toggleOff();
  setSourceStatus("Connecting audio source...");

  try {
    let stream;
    let message;

    if (audioSourceType.value === "display") {
      stream = await acquireDisplayAudio();
      message = "Tab or desktop audio connected.";
    } else {
      stream = await acquireAudioInput(audioInputDevice.value);
      const selectedLabel = audioInputDevice.selectedOptions[0]?.textContent;
      message = `${selectedLabel || "Audio input"} connected.`;
    }

    await useLocalStream(stream, message);
    await refreshAudioInputs();
  } catch (error) {
    console.error("Could not connect audio source:", error);
    setSourceStatus(error.message || "Could not connect the selected audio source.", true);
  } finally {
    submitButton.disabled = false;
  }
});

function updateTalkMode() {
  const isContinuous = continuousMode.checked;
  talkHeading.textContent = isContinuous ? "BROADCAST" : "TALK";
  talkModeHint.textContent = isContinuous
    ? "Click once to start broadcasting and again to stop."
    : "Hold to talk.";
}

function setSourceStatus(message, isError = false) {
  audioSourceStatus.textContent = message;
  audioSourceStatus.classList.toggle("source-error", isError);
}

updateTalkMode();
