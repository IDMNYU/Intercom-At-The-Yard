let myAudio;
let ssp;
let otherAudios = {};
let audible = [];
let thisZone = 0; //default to Microphone User
let p5lm;
let audioID = {};
let isTalking = false;

function setup() {
  noCanvas();
  // Use constraints to request audio from createCapture
  let constraints = {
    audio: true,
    video: false,
    echocancellation: false,
    noiseSuppression: false,
    latency: 0.01, // Set a low latency for real-time communication
    autoGainControl: false
  };
  
  navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
    myAudio = createCapture(constraints, function(stream) {
      console.log("Microphone access granted.");
      p5lm = new p5LiveMedia(this, "CAPTURE", stream, "yard-intercom");
      p5lm.on('stream', gotStream);
      p5lm.on('data', gotData);
      p5lm.on('disconnect', gotDisconnect);
    });
    
    if (myAudio) {
      myAudio.elt.muted = true;
      myAudio.elt.volume = 1.0;
      myAudio.hide();
    }
  }).catch(function(err) {
    noMicrophone();
    console.log(otherAudios)
    console.log("No microphone found or permission denied:", err);
  });
}

function noMicrophone() {
  // Initialize p5LiveMedia in listener-only mode (no capture)
  p5lm = new p5LiveMedia(this, "LISTENER", null, "yard-intercom");
  p5lm.on('stream', gotStream);
  p5lm.on('data', gotData);
  p5lm.on('disconnect', gotDisconnect);
  console.log("Initialized in listener-only mode.");
}

function gotStream(stream, id) {
  console.log("Got stream from peer:", id);
  otherAudios[id] = stream;
  otherAudios[id].elt.muted = true; // mute by default
  otherAudios[id].hide();
}

function gotDisconnect(id) {
  if (otherAudios[id]) {
    otherAudios[id].remove();
    delete otherAudios[id];
  }
}

muteButton = document.getElementById("mute");

muteButton.addEventListener("mousedown", () => 
  toggleOn()
);

muteButton.addEventListener("touchstart", () => 
  toggleOn()
);

muteButton.addEventListener("mouseup", () => 
  toggleOff()
);

muteButton.addEventListener("touchend", () => 
  toggleOff()
);


function toggleOn() {
  if (!isTalking) {
    console.log("Toggling on");
    //muteButton.innerText = "Mute";
    muteButton.classList.add("zoneActive");
    p5lm.send(JSON.stringify(audible)); //send current audible array when unmuted
    isTalking = true;
  } 
}

function toggleOff() {
  if (isTalking) {
    console.log("Toggling off");
    //muteButton.innerText = "Talk";
    muteButton.classList.remove("zoneActive");
    p5lm.send(JSON.stringify([])); //send empty array when muted
    isTalking = false;
  }
}

function config() {
  const configPanel = document.querySelector("#config");
  const isHidden = window.getComputedStyle(configPanel).visibility === "hidden";
  console.log("Toggling config");
  console.log(configPanel);
  if (isHidden) {
    configPanel.style.visibility = "visible";
  } else {
    configPanel.style.visibility = "hidden";
  }
}

form = document.querySelector("#zoneForm");
zoneOptions = document.querySelectorAll(".zone-option");
selectedZoneInput = document.querySelector("#selectedZone");

zoneOptions.forEach((option) => {
  option.addEventListener("click", function() {
    const zoneValue = this.dataset.zone;
    selectedZoneInput.value = zoneValue;
    zoneOptions.forEach((button) => button.classList.remove("zoneActive"));
    this.classList.add("zoneActive");
  });
});

form.addEventListener("submit", function(event) {
  event.preventDefault();
  thisZone = parseInt(selectedZoneInput.value, 10) || 0;
  console.log("thisZone is now", thisZone);
  document.querySelector("#config").style.visibility = "hidden";
});

//loop through checkboxes and add to audible array
form = document.querySelector("#destinationForm");
// form.addEventListener("change", function(event) {
//   audible = [];
//   const checkboxes = document.querySelectorAll('input[name="destination"]');
  
//   checkboxes.forEach((checkbox, index) => {
//     if (checkbox.checked) {
//       audible.push(index); // Add 1 to index to match zone numbers
//     }
//   });
//   if (isTalking) {
//     p5lm.send(JSON.stringify(audible)); //send updated audible array if talking
//   }
// });

function zoneFunction(arg) {
  const zoneButton = document.querySelector(`.zone_${arg}_button`);
  const isActive = zoneButton.classList.toggle("zoneActive");

  if (isActive) {
    if (!audible.includes(arg)) {
      audible.push(arg);
    }
  } else {
    audible = audible.filter((zone) => zone !== arg);
  }

  console.log("audible zones:", audible);
}

function gotData(data, id) {
  try {
    // Parse incoming data
    let dataObj = JSON.parse(data);
    let dataArray = dataObj.zones || dataObj; // Handle both formats
    
    console.log("Received from", id, ":", dataArray);
    
    // Check if this zone should hear the sender
    if (Array.isArray(dataArray) && dataArray.includes(thisZone) || dataArray.includes(0)) {
      console.log("Unmuting audio from peer:", id);
      if (otherAudios[id]) {
        otherAudios[id].elt.muted = false;
        otherAudios[id].elt.volume = 1.0;
      }
    } else {
      console.log("Muting audio from peer:", id);
      if (otherAudios[id]) {
        otherAudios[id].elt.muted = true;
      }
    }
  } catch (e) {
    console.error("Error parsing data:", e);
  }
}
