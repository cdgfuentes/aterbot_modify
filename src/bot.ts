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
	  bot.loadPlugin(pathfinder);
	  bot.loadPlugin(collectBlock);
	  let defaultMove: Movements;
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
		//console.log('===data===',data);
		bot.collectBlock.chestLocations = bot.findBlocks({
			matching: data.blocksByName.chest.id,
			maxDistance: 16,
			count: 999999 // Get as many chests as we can
		  })
		  console.log('=== WHAT2 ===', bot.collectBlock.chestLocations)
		//bot.chat('Hello!');
		console.log('waw', goals.goals)
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
		console.log('Chat Triggered: ', jsonMsg);
		if (username === bot.username) return;
		switch (jsonMsg) {
		  case 'sleep':			
			goToSleep();
			break;
		  case 'wakeup':
			wakeUp();
			break;		
		  case 'follow':
			follow(username);
			break;
		  case 'stop follow':
			stopFollow(username);
			break;
		}
		const args = jsonMsg.split(' ')
		if (args[0] !== 'collect') return

		// If the player specifies a number, collect that many. Otherwise, default to 1.
		let count = 1
		if (args.length === 3) count = parseInt(args[1])
	  
		// If a number was given the item number is the 3rd arg, not the 2nd.
		let type = args[1]
		if (args.length === 3) type = args[2]
	  
		// Get the id of that block type for this version of Minecraft.
		const blockType = data.blocksByName[type]
		if (!blockType) {
		  bot.chat(`I don't know any blocks named ${type}.`)
		  return
		}
	  
		// Find all nearby blocks of that type, up to the given count, within 64 blocks.
		const blocks = bot.findBlocks({
		  matching: blockType.id,
		  maxDistance: 64,
		  count: count
		})
	  
		// Complain if we can't find any nearby blocks of that type.
		if (blocks.length === 0) {
		  bot.chat("I don't see that block nearby.")
		  return
		}
	  
		// Convert the block position array into a block array to pass to collect block.
		const targets = []
		for (let i = 0; i < Math.min(blocks.length, count); i++) {
		  targets.push(bot.blockAt(blocks[i]))
		}

		bot.collectBlock.collect(targets, err => {
			if (err) bot.chat(err.message)
		})
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
	} catch (error) {
	  console.error('Error creating bot:', error);
	  // You might want to handle this error appropriately
	}
  };  

export default (): void => {
	createBot();
};
