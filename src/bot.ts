import Mineflayer from 'mineflayer';
import { sleep, getRandom } from "./utils.ts";
import CONFIG from "../config.json" assert {type: 'json'};
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');


let loop: NodeJS.Timeout;
let bot: Mineflayer.Bot;

const disconnect = (): void => {
	clearInterval(loop);
	bot?.quit?.();
	bot?.end?.();
};
const reconnect = async (): Promise<void> => {
	console.log(`Trying to reconnect in ${CONFIG.action.retryDelay / 1000} seconds...\n`);

	disconnect();
	await sleep(CONFIG.action.retryDelay);
	createBot();
	return;
};

const createBot = (): void => {
	try {
	  // Create the bot instance
	  bot = Mineflayer.createBot({
		host: CONFIG.client.host,
		port: +CONFIG.client.port,
		username: CONFIG.client.username
	  } as const);
  
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
		const defaultMove = new Movements(bot)

		const changePos = async (): Promise<void> => {
		  const lastAction = getRandom(CONFIG.action.commands) as Mineflayer.ControlState;
		  const halfChance: boolean = Math.random() < 0.5;
  
		  console.debug(`${lastAction}${halfChance ? " with sprinting" : ''}`);
  
		  bot.setControlState('sprint', halfChance);
		  bot.setControlState(lastAction, true);
  
		  await sleep(CONFIG.action.holdDuration);
		  bot.clearControlStates();
		};
  
		const changeView = async (): Promise<void> => {
		  const yaw = (Math.random() * Math.PI) - (0.5 * Math.PI);
		  const pitch = (Math.random() * Math.PI) - (0.5 * Math.PI);
  
		  await bot.look(yaw, pitch, false);
		};
  
		const typeAfk = async (): Promise<void> => {
		  bot.chat('/afk');
		};
  
		loop = setInterval(() => {
		  changeView();
		  changePos();
		}, CONFIG.action.holdDuration);
	  });
  
	  bot.once('login', () => {
		console.log(`AFKBot logged in ${bot.username}\n\n`);
	  });
  
	  // Listen for chat messages
	  bot.on('chat', (username, jsonMsg) => {
		console.log('aaa');
		//if (username === bot.username) return;
		console.log('bbb');
		switch (jsonMsg) {
		  case 'sleep':			
			goToSleep();
			break;
		  case 'wakeup':
			wakeUp();
			break;		
		  case 'follow':
			follow();
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
			bot.chat("I'm sleeping")
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

	  async function follow(){
		const target = bot.players[username] ? bot.players[username].entity : null
			if (!target) {
			bot.chat('I cant see you')
			return
			}
			const p = target.position
	
			bot.pathfinder.setMovements(defaultMove)
			bot.pathfinder.setGoal(new GoalNear(p.x, p.y, p.z, 1))
	 }
	} catch (error) {
	  console.error('Error creating bot:', error);
	  // You might want to handle this error appropriately
	}
  };  

export default (): void => {
	createBot();
};
