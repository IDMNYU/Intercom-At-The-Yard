const INTERCOM_ROOM = import.meta.env.VITE_INTERCOM_ROOM || "yard-intercom";

function disableImgDragging() {
	var images = document.getElementsByTagName("img");
	for(var i = 0 ; i < images.length ; i++) {
		images[i].classList.add('no-drag');
		images[i].setAttribute('no-drag', 'on');
		images[i].setAttribute('draggable', 'false');
		images[i].addEventListener('dragstart', function( event ) {
			event.preventDefault();
		}, false);	
	}
}
disableImgDragging();

let myAudio;
let ssp;
let otherAudios = {};
let audible = [];
let thisZone = 0; //default to Microphone User
let p5lm;
let audioID = {};
let isTalking = false;
const muteButton = document.getElementById("mute");
const zoneForm = document.querySelector("#zoneForm");
const zoneOptions = document.querySelectorAll(".zone-option");
const selectedZoneInput = document.querySelector("#selectedZone");

window.setup = function setup() {
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
      p5lm = new p5LiveMedia(window, "CAPTURE", stream, INTERCOM_ROOM);
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
};

function noMicrophone() {
  // Initialize p5LiveMedia in listener-only mode (no capture)
  p5lm = new p5LiveMedia(window, "LISTENER", null, INTERCOM_ROOM);
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

muteButton.addEventListener("pointerdown", () => 
  toggleOn()
);

muteButton.addEventListener("pointerup", () => 
  toggleOff()
);

muteButton.addEventListener("pointerleave", () => 
  toggleOff()
);

muteButton.addEventListener("pointercancel", () => 
  toggleOff()
);

window.addEventListener("pointerup", () =>
  toggleOff()
);

window.addEventListener("pointercancel", () =>
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

window.config = function config() {
  const configPanel = document.querySelector("#config");
  const isOpen = configPanel.classList.contains("isOpen");
  console.log("Toggling config");
  console.log(configPanel);
  if (!isOpen) {
    configPanel.classList.add("isOpen");
  } else {
    configPanel.classList.remove("isOpen");
  }
};

zoneOptions.forEach((option) => {
  option.addEventListener("click", function() {
    const zoneValue = this.dataset.zone;
    selectedZoneInput.value = zoneValue;
    zoneOptions.forEach((button) => button.classList.remove("zoneActive"));
    this.classList.add("zoneActive");
  });
});

zoneForm.addEventListener("submit", function(event) {
  event.preventDefault();
  thisZone = parseInt(selectedZoneInput.value, 10) || 0;
  console.log("thisZone is now", thisZone);
  document.querySelector("#config").classList.remove("isOpen");
});

//loop through checkboxes and add to audible array
const destinationForm = document.querySelector("#destinationForm");
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

window.zoneFunction = function zoneFunction(arg) {
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
};

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
