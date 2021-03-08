import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { v4 as uuidv4 } from 'uuid'

const app = express()
const server = createServer(app)
const io = new Server(server)

const rooms = {}

io.on('connect', socket => {
  socket.on('join', roomID => {
    if (rooms[roomID]) {
      rooms[roomID].push(socket.id)
    } else {
      rooms[roomID] = [socket.id]
    }
    const otherUser = rooms[roomID].find(id => id !== socket.id)
    if (otherUser) {
      socket.emit('other user', otherUser)
      io.to(otherUser).emit('user joined', socket.id)
    }
  })

  socket.on('offer', payload => {
    io.to(payload.target).emit('offer', payload)
  })

  socket.on('answer', payload => {
    io.to(payload.target).emit('answer', payload)
  })

  socket.on('icecandidate', incoming => {
    io.to(incoming.target).emit('icecandidate', incoming)
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
