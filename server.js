const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');

const app = express();
let server = http.createServer(app);
let io = socketIO(server);

app.use(express.static(path.join(__dirname,"")));

var userConnections =[];

io.on("connection", function(socket){
    console.log("socket id is ", socket.id);
    socket.on("userconnect", function(data){
        console.log("userconnect", data.displayName, data.meetingId);
        var other_users = userConnections.filter(function(p){
            p.meeting_id == data.meetingId
        });
        userConnections.push({
            connectionId: socket.id,
            user_id: data.displayName,
            meeting_id: data.meetingId,
        });


        other_users.forEach(function(v){
            socket.to(v.connectionId).emit("inform_other_about_me",{
                other_user_id: data.displayName,
                connId: socket.id,
            });
                
        });
        socket.emit("inform_me_about_other_user", other_users);

    });
    socket.on("SDPProcess", function(data){
        socket.to(data.to_connid).emit("SDPProcess", {
            message: data.message,
            from_connid: socket.id,
        });
    });
})

server.listen(process.env.PORT || 3000, function(){
    console.log('Server is up on port 3000');
});