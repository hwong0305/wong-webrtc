const videoGrid = document.getElementById('video-grid')
const onlineBtn = document.getElementById('online')
const callBtn = document.getElementById('call')

const peers = {}
const userVideos = {}
let localstream

async function online() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  })

  const video = document.createElement('video')
  video.width = 480
  video.height = 360
  video.srcObject = stream
  video.muted = true
  video.play()

  videoGrid.appendChild(video)
  localstream = stream
}

onlineBtn.addEventListener('click', online)

async function call() {
  const socket = io('/')

  socket.emit('join', ROOM_ID)

  socket.on('other user', userID => {
    callUser(userID)
  })

  socket.on('offer', handleOffer)
  socket.on('answer', handleAnswer)
  socket.on('icecandidate', handleNewICECandidateMsg)

  function callUser(userID) {
    peers[userID] = createPeer(userID)
    localstream.getTracks().forEach(track => {
      peers[userID].addTrack(track, localstream)
    })
  }

  function createPeer(userID) {
    const peer = new RTCPeerConnection()

    peer.addEventListener('icecandidate', e =>
      handleICECandidateEvent(e, userID)
    )
    peer.addEventListener('track', e => handleTrack(e, userID))
    peer.addEventListener('negotiationneeded', () => {
      handleNegotiationNeededEvent(userID)
    })

    return peer
  }

  async function handleNegotiationNeededEvent(userID) {
    try {
      console.log(`Negotiation Needed ${userID}`)
      const offer = await peers[userID].createOffer()
      await peers[userID].setLocalDescription(offer)

      const payload = {
        target: userID,
        caller: socket.id,
        offer,
      }

      socket.emit('offer', payload)
    } catch (e) {
      console.log(e)
    }
  }

  async function handleOffer(incoming) {
    try {
      console.log(`Caller: ${incoming.caller} Target: ${incoming.target}`)
      peers[incoming.caller] = createPeer()
      await peers[incoming.caller].setRemoteDescription(incoming.offer)
      localstream
        .getTracks()
        .forEach(track => peers[incoming.caller].addTrack(track, localstream))
      const answer = await peers[incoming.caller].createAnswer()
      await peers[incoming.caller].setLocalDescription(answer)

      const payload = {
        target: incoming.caller,
        caller: socket.id,
        answer,
      }

      socket.emit('answer', payload)
    } catch (e) {
      console.log(e)
    }
  }

  async function handleAnswer(incoming) {
    try {
      const { answer } = incoming
      await peers[incoming.caller].setRemoteDescription(answer)
    } catch (e) {
      console.log(e)
    }
  }

  function handleICECandidateEvent(e, userID) {
    if (e.candidate) {
      const payload = {
        target: userID,
        caller: socket.id,
        candidate: e.candidate,
      }

      socket.emit('icecandidate', payload)
    }
  }

  async function handleNewICECandidateMsg(incoming) {
    // The problem is peers and incoming.target is not the same
    try {
      console.log('on ice candidate')
      await peers[incoming.caller].addIceCandidate(incoming.candidate)
    } catch (e) {
      console.log(e)
    }
  }

  function handleTrack(e, userID) {
    if (!userVideos[userID]) {
      userVideos[userID] = document.createElement('video')
      userVideos[userID].width = 480
      userVideos[userID].height = 360
      userVideos[userID].autoplay = true
      videoGrid.appendChild(userVideos[userID])
    }

    userVideos[userID].srcObject = e.streams[0]
  }
}

callBtn.addEventListener('click', call)
