#!/bin/bash

SESSION_NAME="miladybot"

# Kill session if it exists
tmux kill-session -t $SESSION_NAME 2>/dev/null

# --- Window 0: BOT ---
tmux new-session -d -s $SESSION_NAME -n BOT
tmux send-keys -t $SESSION_NAME:0 "zsh" C-m
tmux send-keys -t $SESSION_NAME:0 "sudo systemctl start mongod" C-m

# --- Window 1: SCRIPTS ---
tmux new-window -t $SESSION_NAME:1 -n SCRIPTS
tmux send-keys -t $SESSION_NAME:1 "cd ~/scripts" C-m
tmux send-keys -t $SESSION_NAME:1 "zsh" C-m
tmux send-keys -t $SESSION_NAME:1 "code ." C-m

# --- Window 2: AMAZON_SERVER ---
tmux new-window -t $SESSION_NAME:2 -n AMAZON_SERVER
tmux send-keys -t $SESSION_NAME:2 "cd ~/Downloads/Keys" C-m
tmux send-keys -t $SESSION_NAME:2 "zsh" C-m
tmux send-keys -t $SESSION_NAME:2 'ssh -i "telegram-bot-key-pair.pem" ubuntu@ec2-15-236-218-255.eu-west-3.compute.amazonaws.com' C-m

# --- Window 3: MONGODB ---
tmux new-window -t $SESSION_NAME:3 -n MONGODB
tmux send-keys -t $SESSION_NAME:3 "zsh" C-m
tmux send-keys -t $SESSION_NAME:3 "mongosh" C-m
tmux send-keys -t $SESSION_NAME:3 "cls" C-m
tmux send-keys -t $SESSION_NAME:3 "use book_store" C-m

# Attach session
tmux attach -t $SESSION_NAME
