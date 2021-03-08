const videoGrid = document.getElementById('video-grid')
const onlineBtn = document.getElementById('online')
const callBtn = document.getElementById('call')

const peers = {}
let partnerVideo
let otherPeer
let otheruser
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
    otherUser = userID
  })

  socket.on('user joined', userID => {
    otherUser = userID
  })

  socket.on('offer', handleOffer)
  socket.on('answer', handleAnswer)
  socket.on('icecandidate', handleNewICECandidateMsg)

  function callUser(userID) {
    peers[userID] = '1'
    otherPeer = createPeer(userID)
    localstream.getTracks().forEach(track => {
      otherPeer.addTrack(track, localstream)
    })
  }

  function createPeer(userID) {
    const peer = new RTCPeerConnection()

    peer.addEventListener('icecandidate', handleICECandidateEvent)
    peer.addEventListener('track', handleTrack)
    peer.addEventListener('negotiationneeded', () => {
      handleNegotiationNeededEvent(userID)
    })

    return peer
  }

  async function handleNegotiationNeededEvent(userID) {
    try {
      console.log(`Negotiation Needed ${userID}`)
      const offer = await otherPeer.createOffer()
      await otherPeer.setLocalDescription(offer)

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
      peers[incoming.caller] = '2'
      otherPeer = createPeer()
      await otherPeer.setRemoteDescription(incoming.offer)
      localstream
        .getTracks()
        .forEach(track => otherPeer.addTrack(track, localstream))
      const answer = await otherPeer.createAnswer()
      await otherPeer.setLocalDescription(answer)

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
      console.log(`Answer ${incoming}`)
      const { answer } = incoming
      await otherPeer.setRemoteDescription(answer)
    } catch (e) {
      console.log(e)
    }
  }

  function handleICECandidateEvent(e) {
    if (e.candidate) {
      const payload = {
        target: otherUser,
        caller: socket.id,
        candidate: e.candidate,
      }

      socket.emit('icecandidate', payload)
    }
  }

  async function handleNewICECandidateMsg(incoming) {
    // The problem is peers and incoming.target is not the same
    try {
      console.log('ICE Candidate Message')
      console.log(`peer ${Object.keys(peers)}, target: ${incoming.target}`)
      await otherPeer.addIceCandidate(incoming.candidate)
    } catch (e) {
      console.log(e)
    }
  }

  function handleTrack(e) {
    if (!partnerVideo) {
      partnerVideo = document.createElement('video')
      partnerVideo.width = 480
      partnerVideo.height = 360
      partnerVideo.autoplay = true
      videoGrid.appendChild(partnerVideo)
    }

    partnerVideo.srcObject = e.streams[0]
  }
}

callBtn.addEventListener('click', call)
