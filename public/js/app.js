$(function(){
    $(document).on("click", ".join-meeting", function(){
        $(".enter-code").focus();
    })
    $(document).on("click", ".join-action", function(){
        var join_value = $('.enter-code').val();
        var meetingUrl = window.location.origin+"?meetingID="+join_value;
        window.location.replace(meetingUrl);
    })
    $(document).on("click", ".new-meeting", function(){
        // Generate random 3-digit numbers
        const firstThreeDigits = Math.floor(Math.random() * 900) + 100;
        const fourDigits = Math.floor(Math.random() * 9000) + 1000;
        const secondThreeDigits = Math.floor(Math.random() * 900) + 100;

        // Create the formatted string
        const formattedString = `${firstThreeDigits}-${fourDigits}-${secondThreeDigits}`;
        var meetingUrl = window.location.origin+"?meetingID="+formattedString;
        window.location.replace(meetingUrl);
    })
})


var AppProcess = (function(){

    var peers_connection_ids = [];
    var peers_connection = [];
    var remote_vid_stream = [];
    var remote_aud_stream = [];
    var local_div;
    var audio;
    var isAudioMute = true;
    var rtp_aud_senders = [];
    var video_states = {
        None: 0,
        Camera: 1
    };
    var video_st = video_states.None;
    var videoCamTrack;

    var serverProcess;

    async function _init(SDP_function, my_connid){
        serverProcess = SDP_function;
        my_connection_id = my_connid;
        eventProcess();
        local_div = document.getElementById("#localVideoPlayer");
    }

    function eventProcess(){
        $("#micMuteUnmute").on("click", async function(){
            if(!audio){
                await loadAudio();
            }
            if(!audio){
                alert("Audio Permission has not granted");
                return;
            }
            if(isAudioMute){
                audio.enabled = true;
                $(this).html("<span class='material-icons'>mic</span>");
                updateMediaSenders(audio,rtp_aud_senders);
            }
            else{
                audio.enabled = false;
                $(this).html("<span class='material-icons'>mic_off</span>");
                removeMediaSenders(rtp_aud_senders);
            }
            isAudioMute = !isAudioMute;

        });

        $("#videoCamOnOff").on("click", async function(){
            if(video_st == video_states.Camera){
                await videoProcess(video_states.None)
            }else{
                await videoProcess(video_states.Camera)
            }
        });
    }

    async function videoProcess(newVideoState){
        try{
            var vstream = null;
            if(newVideoState == video_states.Camera){
                vstream = await navigator.mediaDevices.getUserMedia({
                    video:{
                        width: 1920,
                        height: 1080,
                    },
                    audio: false
                });
            } 
            if(vstream && vstream.getVideoTracks().length > 0){
                videoCamTrack = vstream.getVideoTracks()[0];
                if(videoCamTrack){
                    local_div.srcObject = new MediaStream([videoCamTrack]);
                    alert("video Cam Found");

                }
            }
        }catch(e){
            console.log(e);
            return;

        }
        video_st = newVideoState;


    }

    var iceConfiguration = {
        iceServers:[
            {
                urls:"stun:stun.l.google.com:19302",
            },
            {
                urls:"stun.stun1.l.google.com:19302",
            },
        ],
    };

    async function setConnection(connId){
        var connection = new RTCPeerConnection(iceConfiguration);

        connection.onnegotiationneeded = async function(event){
            await setOffer(connId);
        };
        connection.onicecandidate = function(event){
            if(event.candidate){
                serverProcess(JSON.stringify({icecandidate: event.candidate}),
                connId);
            }
        };
        connection.ontrack = function(event){
            if(!remote_vid_stream[connId]){
                remote_vid_stream[connId] = new MediaStream();
            }

            if(!remote_aud_stream[connId]){
                remote_aud_stream[connId] = new MediaStream();
            }

            if(event.track.kind == "video"){
                remote_vid_stream[connId].getVideoTracks().forEach(function(t){
                    remote_vid_stream[connId].removeTrack(t)
                });
                remote_vid_stream[connId].addTrack(event.track);
                var remoteVideoPlayer = document.getElementById("v_"+connId);
                remoteVideoPlayer.srcObject = null;
                remoteVideoPlayer.srcObject = remote_vid_stream[connId];
                remoteVideoPlayer.load();
            }else if(event.track.kind == "audio"){
                remote_aud_stream[connId].getAudioTracks().forEach(function(t){
                    remote_aud_stream[connId].removeTrack(t)
                });
                remote_aud_stream[connId].addTrack(event.track);
                var remoteAudioPlayer = document.getElementById("a_"+connId);
                remoteAudioPlayer.srcObject = null;
                remoteAudioPlayer.srcObject = remote_aud_stream[connId];
                remoteAudioPlayer.load();
            }
        };

        peers_connection_ids[connId] = connId;
        peers_connection[connId] = connection;

        return connection;
    }

    async function setOffer(connId){
        var connection = peers_connection[connId];
        var offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        serverProcess(JSON.stringify({
            offer: connection.localDescription,
        }),connId);
    }

    async function SDPProcess(message, from_connid){
        message = JSON.parse(message);
        if(message.answer){
            await peers_connection[from_connid].setRemoteDescription(new RTCSessionDescription(message.answer))

        }else if(message.offer){
            if(!peers_connection[from_connid]){
                await setConnection(from_connid);
            }
            await peers_connection[from_connid].setRemoteDescription(new RTCSessionDescription(message.offer));
            var answer = await peers_connection[from_connid].createAnswer();
            await peers_connection[from_connid].setLocalDescription(answer);
            serverProcess(JSON.stringify({
                answer: answer,
            }),from_connid);
        }else if(message.icecandidate){
            if(!peers_connection[from_connid]){
                await setConnection(from_connid);
            }
            try{
                await peers_connection[from_connid].addIceCandidate(message.icecandidate);
            }
            catch(e){
                console.log(e);
            }

        }
    }

    return{
        setNewConnection: async function(connId){
            await setConnection(connId);
        },
        init: async function(SDP_function, my_connid){
            await _init(SDP_function, my_connid);
        },
        processClientFunc: async function(data, from_connid){
            await SDPProcess(data , from_connid);
        },

    };
})();



//The module provides a way for other parts of the code to access and use the init function.

//The code provides a way to call the init function from outside the module 'MyApp' by using the _init function. 
//It's like having a box (the module) with a space (the init function) and a small opening (the _init function) to interact with that space from the outside.
var MyApp = (function(){
    var socket = null;
    var user_id = "";
    var meeting_id = "";

    function init(uid, mid){
        user_id = uid;
        meeting_id = mid;
        $("#meetingContainer").show();
        $("#me h2").text(user_id + "(Me)");
        document.title = user_id;
        event_process_for_signaling_server();
    }

    function event_process_for_signaling_server(){
        socket = io.connect();

        var SDP_function = function(data, to_connid){
            socket.emit("SDPProcess", {
                message: data,
                to_connid: to_connid
            })
        }
        socket.on("connect", function(){
            if(socket.connected){
                AppProcess.init(SDP_function, socket.id)
                if(user_id != "" && meeting_id != ""){
                    socket.emit("userconnect", {
                        displayName: user_id,
                        meetingId: meeting_id,
                    });
                }
            }
        });

        socket.on("inform_other_about_me",function(data){
            addUser(data.other_user_id, data.connId);
            AppProcess.setNewConnection(data.connId);
        });

        socket.on("inform_me_about_other_user",function(other_users){
            if(other_users){
                for(var i = 0; i<other_users.length; i++){
                    addUser(other_users[i].user_id, other_users[i].connectionId);
                    AppProcess.setNewConnection(other_users[i].connectionId);
                }
            }
            
        });


        socket.on("SDPProcess", async function(data){
            await AppProcess.processClientFunc(data.message, data.from_connid);
        })
    }

    function addUser(other_user_id, connId){
        var newDivId = $("#otherTemplate").clone();
        newDivId = newDivId.attr("id", connId).addClass("other");
        newDivId.find("h2").text(other_user_id);
        newDivId.find("video").attr("id","v_"+connId);
        newDivId.find("audio").attr("id","a_"+connId);
        newDivId.show();
        $("#divUsers").append(newDivId);
    }

    return{
        _init: function(uid, mid){
            init(uid, mid)
        }
    }
})();   //An immediately invoked function expression (IIFE) is a JavaScript function that is defined and executed right away. It is typically wrapped inside parentheses and followed by an additional pair of parentheses to immediately invoke it.
        //The purpose of using an IIFE is to create a private scope for the code inside it. By enclosing the code within the function and immediately invoking it, the variables and functions defined inside the function are not accessible from the outside. 
        //This helps prevent conflicts or pollution of the global scope and allows for better encapsulation of code.