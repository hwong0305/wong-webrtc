import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { v4 as uuidv4 } from 'uuid'

const app = express()
const server = createServer(app)
const io = new Server(server)

const peers = {}

io.on('connect', socket => {
  socket.on('join', roomID => {
    if (peers[roomID]) {
      peers[roomID].push(socket.id)
    } else {
      peers[roomID] = [socket.id]
    }

    const otherUser = peers[roomID].find(id => id !== socket.id)
    if (otherUser) {
      socket.emit('other user', otherUser)
      socket.to(otherUser).emit('user joined', socket.id)
    }

    // socket.emit(
    //   'other users',
    //   peers[roomID].filter(e => e !== socket.id)
    // )
  })

  socket.on('icecandidate', payload => {
    const { candidate, target } = payload
    console.log({
      target,
      user: socket.id,
    })

    const outgoingPayload = {
      candidate,
      target: socket.id,
    }

    socket.to(target).emit('icecandidate', outgoingPayload)
  })

  socket.on('offer', payload => {
    const { target, offer } = payload
    console.log({
      target,
      user: socket.id,
    })

    const outgoingPayload = {
      target: socket.id,
      offer,
    }

    socket.to(target).emit('offer', outgoingPayload)
  })

  socket.on('answer', payload => {
    const { target, answer } = payload
    console.log({
      target,
      user: socket.id,
    })

    const outgoingPayload = {
      target: socket.id,
      answer,
    }

    socket.to(target).emit('answer', outgoingPayload)
  })
})

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.get('/', (req, res) => {
  res.redirect(`/${uuidv4()}`)
})

app.get('/:room', (req, res) => {
  res.render('room', {
    roomId: req.params.room,
  })
})

server.listen(5050, () => {
  console.log('now listening on port 5050')
})
