from stable_baselines3 import PPO, DDPG, DQN, A2C, SAC
from dm_control_local import suite
import gym
from gym import spaces
import numpy as np
import asyncio

from PIL import Image
from time import sleep
import subprocess

from torch import nn
from stable_baselines3.common.callbacks import BaseCallback

from torch.utils.tensorboard import SummaryWriter
from stable_baselines3.common.vec_env import DummyVecEnv

class CustomCallback(BaseCallback):
    """
    A custom callback that derives from ``BaseCallback``.

    :param verbose: (int) Verbosity level 0: not output 1: info 2: debug
    """
    def __init__(self, verbose=0):
        super(CustomCallback, self).__init__(verbose)
        # Those variables will be accessible in the callback
        # (they are defined in the base class)
        # The RL model
        # self.model = None  # type: BaseAlgorithm
        # An alias for self.model.get_env(), the environment used for training
        # self.training_env = None  # type: Union[gym.Env, VecEnv, None]
        # Number of time the callback was called
        # self.n_calls = 0  # type: int
        #self.num_timesteps = 0  # type: int
        # local and global variables
        # self.locals = None  # type: Dict[str, Any]
        # self.globals = None  # type: Dict[str, Any]
        # The logger object, used to report things in the terminal
        # self.logger = None  # stable_baselines3.common.logger
        # # Sometimes, for event callback, it is useful
        # # to have access to the parent object
        # self.parent = None  # type: Optional[BaseCallback]
        self.locals['n_rollout_steps'] = 200

    def _on_rollout_start(self) -> None:
        """
        A rollout is the collection of environment interaction
        using the current policy.
        This event is triggered before collecting new samples.
        """
        t = self.num_timesteps

        if (t % 100000) < 200:
            asyncio.run(frames_to_video(t, str(0), t))
            model.save("deepq_swimmer_"+str(t))


    def _on_rollout_end(self) -> None:
        """
        This event is triggered before updating the policy.
        """
        t = self.num_timesteps

        # if t % 100 == 0:
        #     y = self.locals['infos'][0]['episode']['r']
        #     writer.add_scalar(f'mujoco reward', y, t)
        print(t)
        if (t % 100000) < 200:
            asyncio.run(frames_to_video(t, str(0), t))
            model.save("deepq_swimmer_"+str(t))


    def _on_step(self) -> bool:
        """
        This method will be called by the model after each call to `env.step()`.

        For child callback (of an `EventCallback`), this will be called
        when the event is triggered.

        :return: (bool) If the callback returns False, training is aborted early.
        """
        t = self.num_timesteps
        print(t)
        if (t % 100000) < 200:
            asyncio.run(save_frame(self.num_timesteps % 200, 0, self.model.env.envs[0]))

        return True


# FRAMES = []
async def save_frame(timestep, ind, env):
    jump = 4
    if timestep % jump == 0:
        pixels = env.render_mujoco()  # camera_id="back"
        # img = np.reshape(pixels, (3, 480, 640))
        # writer.add_image("tag" + str(ind), img)
        # FRAMES.append(pixels)
        im = Image.fromarray(pixels, 'RGB')
        im.save("frames/ind.{}-frame-{:06.0f}.png".format(ind, timestep / jump))


async def frames_to_video(timestep, ind, gen_num):
    sleep(3)

    subprocess.run([
        'ffmpeg', '-framerate', '5', '-y', '-i', 'frames/ind.{}-frame-%06d.png'.format(ind), '-r', '30', '-pix_fmt',
        'yuv420p', 'videos/rl/gen_num.{}-ind.{}-video_name_{:06.0f}.mp4'.format(gen_num, ind, timestep)
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


class Swim_env(gym.Env):
    def __init__(self, env_config=None):
        self.env = suite.load('swimmer', 'swimmer6', visualize_reward=True,
                              environment_kwargs={"flat_observation": True})

        print(self.env.action_spec().minimum)
        print(self.env.observation_spec()["observations"]._shape
              )

        min_a = self.env.action_spec().minimum * 3
        max_a = self.env.action_spec().maximum * 3
        # spaces.Box(np.array(min_a), np.array(max_a), dtype=np.float32)
        # Continuous
        self.action_space = spaces.Box(low=np.array(min_a), high=np.array(max_a), dtype=np.float32)

        # Discrete
        #self.granular = 5  # from -1 to 1 dividided in self.granular pieces
        #self.num_servos = len(min_a)
        #self.action_space = spaces.MultiDiscrete([self.granular] * self.num_servos)
        #self.ACTION_TO_TORQUE = {i: self.normalize(i) for i in range(self.granular)}

        min_s = -10
        max_s = 10
        s_shape = self.env.observation_spec()["observations"].shape
        self.observation_space = spaces.Box(low=min_s, high=max_s, shape=(s_shape[0] + 3,), dtype=np.float32)
        self.time_step = 0

    def normalize(self, x):
        # IN: x in [0, 4] in Integers
        x = x / (self.granular - 1)
        x = 2*x - 1

        return x

    def step(self, action):
        #print(action)
        #action = [self.ACTION_TO_TORQUE[a] for a in action] # -1 0 1 instead of 0 1 2
        #action = np.array(list(map(self.normalize, action)))

        cycle_len = 50
        s = self.env.step(action)
        self.time_step += 1 # TODO Use number of steps per episode
        # print(s)
        osci_1 = np.sin(self.time_step / cycle_len * 2 * np.pi)
        osci_2 = np.sin(self.time_step / cycle_len * 2 * np.pi + np.pi / 2)
        osci_3 = np.sin(self.time_step / cycle_len * 2 * np.pi + np.pi)
        obs = np.concatenate([s.observation['observations'],
                              [osci_1, osci_2, osci_3]])
        reward = s.reward
        done = s.last()
        info = {'osci_1': osci_1}
        return obs, reward, done, info

    def reset(self):
        s = self.env.reset()
        self.time_step = 0
        osci_1 = np.sin(0)
        osci_2 = np.sin(np.pi / 2)
        osci_3 = np.sin(np.pi)
        obs = np.concatenate([s.observation['observations'],
                              [osci_1, osci_2, osci_3]])
        return obs

    def render_mujoco(self):
        return self.env.physics.render(width=640, height=480)

    def get_env(self):
        return self.env

if __name__ == "__main__":
    writer = SummaryWriter('logdir')
    # env = suite.load('swimmer', 'swimmer6', visualize_reward=True)  # , task_kwargs={"random": gen_num})
    from stable_baselines3.common.callbacks import CheckpointCallback
    env = Swim_env()

    timesteps = 300000000
    num_eval_steps = 600

    checkpoint_callback = CheckpointCallback(save_freq=50000, save_path='./logs/',
                                             name_prefix='rl_model')
    custom_callback = CustomCallback()

    model = SAC("MlpPolicy",
                 env,
                 #learning_starts=10000,
                 #train_freq=(32, 'episode'),
                 policy_kwargs={
                    #'net_arch': [dict(pi=[16, 8, 4], vf=[16, 8, 4])],
                     'net_arch': [16, 8, 4],
                     #'sde_net_arch': True,

                    #'activation_fn': nn.Tanh,
                    #'n_critics': 1,
                    #'share_features_extractor': True
                        },
                 #use_rms_prop=False,
                 device='cpu',
                 tensorboard_log='./runs',
                 verbose=1)
    # env = DummyVecEnv([lambda: env])
    # model = DDPG.load("deepq_swimmer",
    #                   env=env,
    #                   force_reset=True,
    #                   policy_kwargs={'net_arch': [2, 2, 2],
    #                                  'activation_fn': nn.Tanh,
    #                                  'n_critics': 1},
    #                   tensorboard_log='./runs',
    #                   device='cpu',
    #                   verbose=2)

    model.learn(total_timesteps=timesteps,
                callback=custom_callback,
                #log_interval=10000,
                tb_log_name='SAC',
                )
    model.save("deepq_swimmer")

    #del model  # remove to demonstrate saving and loading

    #model = DDPG.load("deepq_swimmer")

    obs = env.reset()
    done = False
    timestep = 0
    ind = 0
    # while not done:
    while timestep < num_eval_steps:
        asyncio.run(save_frame(timestep, ind, env))
        action, _states = model.predict(obs)

        obs, rewards, dones, info = env.step(action)
        timestep += 1

    asyncio.run(frames_to_video(timestep, ind, timesteps))

    # NUM_TIMESTEPS = 200
    # # while not total_observation.last():
    # for i in range(NUM_TIMESTEPS):
    #     action, _states = model.predict(obs)
    #     obs, rewards, done, info = env.step(action)
    #     #env.render()
    #
    #     if ind in [0,1] and gen_num % 10 == 0:
    #         asyncio.run(save_frame(timestep, ind, env))
