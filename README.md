# Intercom at The Yard
A web application for intercom style 📢 voice communication 🗣️ 🔈 between different "zones" at NYU Tandon at The Yard. The intercom system is used for announcements mostly during public events and showcases.

Made using p5LiveMedia by @vanevery, an implementation of WebRTC and socket.io in p5.js. For more information on p5LiveMedia see Shawn's [github repo](https://github.com/vanevery/p5LiveMedia) here.

This repo is intended to provide a starting point for DIY, networked, multi-zone announcement systems.

![main](documentation/intercom-main.png)

## Hardware
*Intercom-at-the-Yard* is run in the browser on Raspberry Pi computers connected to speakers at 4 sites in our facility. These are referred to as an *"endpoint"* in this repo.

Here is a picture of one of our endpoints 😌.
![zone1](documentation/zone1.jpeg)

Oh my here is another! 🌸 How they are wise, listen to them!
![zone1](documentation/zone3.jpeg)


## Installation 
With node installed run:
```
npm install
```

After dependencies are installed run:

```
npm run dev
```

You should now be able to test the app locally. 

## Deployment
I use vercel to deploy the repo 
## Usage
Deploy the website using a unique *room name*. The *room name* is configured in the .env file. See the .env.example file in this repo. 

Change the environment variable to create a dedicated private channel for your intercom endpoints. Make sure this variable is hard to guess! Otherwise strangers might be able to make **strange noises** in your endpoints.

To designate a speaker/computer pair as an endpoint. Simply...

* connect a computer (we use small Raspberry Pi computers) to a loudspeaker and point it's browser to your hosted clone of this repo. 

* Click the hamburger 🍔 menu and select a zone and click *submit*. 
  
To address the endpoint from a microphone simply...

* point your desktop or mobile browser (make sure it has a microphone connected 🎤) to your hosted clone of this repo. Select a zone using he touch interface and hold down the *talk* button.

![image](documentation/zoneselect.png)

Selecting a zone allows other users of the website to unmute their microphone feed on that peer connection when pressing the "Talk" button. 

![talking_img](documentation/talking.png)

Be sure to press the "Mute" button when you are done talking...

![muting](documentation/mute.png)

## Attribution
Tommy Martinez @ogbabydiesal: hardware systems and programming

Ava Kling @avasion: Design

Shawn Van Every @vanevery: p5LiveMedia, main dependencies

Todd Bryant: Inspo and Encouragement