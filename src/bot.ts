import Mineflayer from 'mineflayer';
import { sleep, getRandom } from "./utils.ts";
import CONFIG from "../config.json" assert {type: 'json'};
import { pathfinder, Movements } from 'mineflayer-pathfinder';
import goals from 'mineflayer-pathfinder';
import { plugin as collectBlock } from 'mineflayer-collectblock';
import mcData from 'minecraft-data';

let loop: NodeJS.Timeout;
let bot: Mineflayer.Bot;
let data;
const disconnect = (): void => {
	clearInterval(loop);
	bot?.quit?.();
	bot?.end?.();
};
const reconnect = async (): Promise<void> => {
	console.log(`Trying to reconnect in ${15000 / 1000} seconds...\n`);

	disconnect();
	await sleep(15000);
	createBot();
	return;
};

const createBot = (): void => {
	try {
	  // Create the bot instance
	  bot = Mineflayer.createBot({
		host: process.env.MINECRAFT_CLIENT_HOST,
		port: process.env.MINECRAFT_CLIENT_PORT,
		username: process.env.MINECRAFT_USERNAME
	  } as const);
	  bot.loadPlugin(pathfinder);
	  bot.loadPlugin(collectBlock);
	  let defaultMove: Movements;
	  let playersToTeleport: string[] = [];

	  // Handle errors
	  bot.once('error', error => {
		console.error(`AFKBot got an error: ${error}`);
		// You might want to consider reconnecting here
	  });
  
	  bot.once('kicked', rawResponse => {
		console.error(`\n\nAFKbot is disconnected: ${rawResponse}`);
		// You might want to consider reconnecting here
	  });
  
	  bot.once('end', () => void reconnect());
  
	  // Clear previous chat listeners
	  bot.removeAllListeners('chat');
  
	  // Listen for the 'spawn' event
	  bot.once('spawn', () => {
		defaultMove = new Movements(bot)
		data = mcData(bot.version);

		//bot.chat('Hello!');
		const changePos = async (): Promise<void> => {
		  const lastAction = getRandom(CONFIG.action.commands) as Mineflayer.ControlState;
		  const halfChance: boolean = Math.random() < 0.5;
  
		  //console.debug(`${lastAction}${halfChance ? " with sprinting" : ''}`);
  
		  bot.setControlState('sprint', halfChance);
		  bot.setControlState(lastAction, true);
  
		  await sleep(process.env.HOLD_DURATION);
		  bot.clearControlStates();
		};
  
		const changeView = async (): Promise<void> => {
		  const yaw = (Math.random() * Math.PI) - (0.5 * Math.PI);
		  const pitch = (Math.random() * Math.PI) - (0.5 * Math.PI);
  
		  await bot.look(yaw, pitch, false);
		};
  
		loop = setInterval(() => {
		  changeView();
		  changePos();
		}, 15000);
	  });
  
	  bot.once('login', () => {
		console.log(`AFKBot logged in ${bot.username}\n\n`);
	  });
  
	  // Listen for chat messages
	  bot.on('chat', async (username, jsonMsg) => {
		console.log('Chat Triggered: ', jsonMsg);
		if (username === bot.username) return;

		switch (jsonMsg) {
		  case 'sleep112233441':			
			goToSleep();
			break;
		  case 'wakeup12333':
			wakeUp();
			break;		
		  case 'follow12333':
			follow(username);
			break;
		  case 'stop12333':
			stopFollow(username);
			break;
		}
	  });
	  
	  async function goToSleep () {
		const bed = bot.findBlock({
		  matching: block => bot.isABed(block)
		})
		if (bed) {
		  try {
			await bot.sleep(bed)
			bot.chat("Sleeping...")
		  } catch (err) {
			bot.chat(`I can't sleep, ${err.message}`)
		  }
		} else {
		  bot.chat('No nearby bed')
		}
	  }
	  async function wakeUp () {
		try {
		  await bot.wake()
		} catch (err) {
		  bot.chat(`I can't wake up, ${err.message}`)
		}
	  }

	  async function follow(username){
		const target = bot.players[username] ? bot.players[username].entity : null
			//bot.chat(`Following: ${username}`)
			if (!target) {
			bot.chat('I cant see you, too far.')
			return
			}
			const p = target.position
			
			bot.pathfinder.setMovements(defaultMove)
			const testGoal = new goals.goals.GoalFollow(target, 2)
			bot.pathfinder.setGoal(testGoal,true)
	 }

	 
	 async function stopFollow(username){
		//bot.chat(`Stopped following: ${username}`)
		const target = bot.players[username] ? bot.players[username].entity : null
			if (!target) {			
			return
			}
			bot.pathfinder.setGoal(null)
	 }


	 const teleportToPlayers = async (): Promise<void> => {
		while (true) { // Infinite loop
		  for (let i = 0; i < playersToTeleport.length; i++) {
			const playerName = playersToTeleport[i];
			const player = bot.players[playerName];
			if (player) {
			  //bot.chat(`Attempting to teleport to: ${playerName}`);
			  bot.chat(`/tp ${bot.username} ${playerName}`);
			  await new Promise(resolve => setTimeout(resolve, 15000)); // 15000 milliseconds = 15 seconds
			}
		  }
		}
	  };
	  
	  bot.on('spawn', () => {
		updatePlayersList(); 		
		teleportToPlayers();		
	  });
	 
	 const updatePlayersList = (): void => {
	   const players = Object.values(bot.players);
	   playersToTeleport = players.map(player => player.username);	   
	 };
	 
	 // Listen for player joins
	 bot.on('playerJoined', (player) => {
	   updatePlayersList(); // Update the list when a new player joins
	 });
	 
	 // Listen for player leaves
	 bot.on('playerLeft', (player) => {
	   updatePlayersList(); // Update the list when a player leaves
	 });
	  
	} catch (error) {
	  console.error('Error creating bot:', error);
	  // You might want to handle this error appropriately
	}
  };  

export default (): void => {
	createBot();
};
