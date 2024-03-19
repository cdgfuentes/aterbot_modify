import Mineflayer from 'mineflayer';
import { sleep, getRandom } from './utils.ts';
import CONFIG from '../config.json';
import { pathfinder, Movements } from 'mineflayer-pathfinder';
import { plugin as collectBlock } from 'mineflayer-collectblock';
import mcData from 'minecraft-data';

let loop: NodeJS.Timeout;
let bot: Mineflayer.Bot;
let data: any; // You can specify the type for data if you know it

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
};

const createBot = (): void => {
  try {
    bot = Mineflayer.createBot({
      host: CONFIG.client.host,
      port: +CONFIG.client.port,
      username: CONFIG.client.username
    } as const);

    bot.loadPlugin(pathfinder);
    bot.loadPlugin(collectBlock);
    let defaultMove: Movements;

    bot.once('error', error => {
      console.error(`AFKBot got an error: ${error}`);
    });

    bot.once('kicked', rawResponse => {
      console.error(`\n\nAFKbot is disconnected: ${rawResponse}`);
    });

    bot.once('end', () => void reconnect());

    bot.removeAllListeners('chat');

    bot.once('spawn', () => {
      defaultMove = new Movements(bot);
      data = mcData(bot.version);

      const changePos = async (): Promise<void> => {
        const lastAction = getRandom(CONFIG.action.commands) as Mineflayer.ControlState;
        const halfChance: boolean = Math.random() < 0.5;

        console.debug(`${lastAction}${halfChance ? ' with sprinting' : ''}`);

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

      loop = setInterval(() => {
        changeView();
        changePos();
      }, CONFIG.action.holdDuration);
    });

    bot.once('login', () => {
      console.log(`AFKBot logged in ${bot.username}\n\n`);
    });

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
        case 'stop':
          stopFollow(username);
          break;
      }
    });

    async function goToSleep(): Promise<void> {
      const bed = bot.findBlock({
        matching: block => bot.isABed(block)
      });
      if (bed) {
        try {
          await bot.sleep(bed);
          bot.chat('Sleeping...');
        } catch (err) {
          bot.chat(`I can't sleep, ${err.message}`);
        }
      } else {
        bot.chat('No nearby bed');
      }
    }

    async function wakeUp(): Promise<void> {
      try {
        await bot.wake();
      } catch (err) {
        bot.chat(`I can't wake up, ${err.message}`);
      }
    }

    async function follow(username): Promise<void> {
      const target = bot.players[username] ? bot.players[username].entity : null;
      if (!target) {
        bot.chat('I cant see you, too far.');
        return;
      }
      const p = target.position;

      bot.pathfinder.setMovements(defaultMove);
      const testGoal = new goals.goals.GoalFollow(target, 2);
      bot.pathfinder.setGoal(testGoal, true);
    }

    async function stopFollow(username): Promise<void> {
      const target = bot.players[username] ? bot.players[username].entity : null;
      if (!target) {
        return;
      }
      bot.pathfinder.setGoal(null);
    }
  } catch (error) {
    console.error('Error creating bot:', error);
  }
};

export default (): void => {
  createBot();
};
