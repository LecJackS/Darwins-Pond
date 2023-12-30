from time import sleep

import torch

from dm_control_local import suite
import numpy as np
from PIL import Image
import subprocess
import asyncio
from copy import copy

import torch

from torch.utils.tensorboard import SummaryWriter
#from tensorboardX import SummaryWriter

# Writer will output to ./runs/ directory by default
writer = SummaryWriter()

#writer.close()
FRAMES = []

def get_action(total_observation, timestep, action_spec, chrom):
    if total_observation == None:
        action = np.random.uniform(action_spec.minimum,
                                   action_spec.maximum,
                                   size=action_spec.shape)
    else:
        act_dim = action_spec.shape[0]

        # 2d vector to target
        x_in = total_observation.observation['to_target']

        # Sin wave of N timesteps per cicle (agen_numt would learn wavy-patterns)
        cycle_len = int(sum(chrom[0, :]) * 100) # 50  # in timesteps
        cycle_len = max(1, cycle_len)
        chrom = chrom[1:, :]

        # Norm 1 vector
        x_in = x_in / np.linalg.norm(x_in)
        # Concatenate Bias + Input values
        x_in = np.concatenate([[1], x_in])

        x_in_dim = len(x_in)
        # Todo: completar con la combinacion lineal de x_in contra parametros dados en chrom? o con algo intermedio
        #       notar que todavia no puedo llamar la funcion con chrom porque no existe chrom en este archivo.

        # M = np.ones((x_in_dim, act_dim))*0.01
        # Sin( t + translation ) * y-scaling
        oscillator = np.sin(timestep / cycle_len * 2 * np.pi + np.pi * chrom[-1, :]) * chrom[-2, :]

        #action = np.tanh(np.matmul(x_in, chrom[:-2, :]) + oscillator)
        action = np.matmul(x_in, chrom[:-2, :]) + oscillator

    return action


#async def save_frame(timestep, ind, env):
def save_frame(timestep, ind, env):
    jump = 4
    if timestep % jump == 0:
        pixels = env.physics.render(width=640, height=480)  # camera_id="back"
        #img = np.reshape(pixels, (3, 480, 640))
        #writer.add_image("tag" + str(ind), img)
        FRAMES.append(pixels)
        im = Image.fromarray(pixels, 'RGB')
        im.save("frames/ind.{}-frame-{:06.0f}.png".format(ind, timestep / jump))


async def frames_to_video(timestep, ind, gen_num):
    sleep(3)


    subprocess.run([
        'ffmpeg', '-framerate', '5', '-y', '-i', 'frames/ind.{}-frame-%06d.png'.format(ind), '-r', '30', '-pix_fmt',
        'yuv420p', 'videos/gen_num.{}-ind.{}-video_name_{:06.0f}.mp4'.format(gen_num, ind, timestep)
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def run_env(chrom, ind, env, gen_num, render=False):
    # Keep same positions for M generations
    M = 10
    # Load one task:
    env = suite.load('swimmer', 'swimmer6', visualize_reward=True, task_kwargs={"random": gen_num // M})
    #env = copy(env)
    # env = suite.load('swimmer', 'swimmer6', visualize_reward=True, task_kwargs={"random": np.random.randint(0, 99999)})
    # Iterate over a task set:
    # for domain_name, task_name in [suite.BENCHMARKING[0]]:
    #     env = suite.load(domain_name, task_name)

    # Step through an episode and print out reward, discount and observation.

    total_observation = env.reset()
    action_spec = env.action_spec()

    timestep = 0
    reward = 0
    gamma = 0.999

    NUM_TIMESTEPS = 200
    VIDEO_STEP = 10 # In generations

    #while not total_observation.last():
    global FRAMES
    FRAMES = []

    for i in range(NUM_TIMESTEPS):
        # chrom = None # TODO Get chromosome array or matrix
        action = get_action(total_observation, timestep, action_spec, chrom)

        total_observation = env.step(action)
        #total_observation = env.step(np.concatenate([action, action]))

        if ind in [0, 1] and gen_num % VIDEO_STEP == 0:
            #asyncio.run(save_frame(timestep, ind, env))
            save_frame(timestep, ind, env)

        timestep += 1

        # print(total_observation)

        # 0: perfect score (0 distance to target)
        # score = - np.linalg.norm(total_observation.observation['to_target'])

        # reward = gamma * reward + total_observation.reward
        # creating a object
        # im = Image.open(r"C:\Users\System-Pc\Desktop\home.png")
        # print(i, total_observation.reward)#, total_observation.discount, total_observation.observation)
        # print(count, score, "\n", total_observation.observation)#, total_observation.discount, total_observation.observation)

    reward = - np.linalg.norm(total_observation.observation['to_target'])
    if ind in [0, 1] and gen_num % VIDEO_STEP == 0:
        # tensorboard takes video of shape (N,T,C,H,W).
        if False:
            # Guardar en tensorboard
            vid = torch.FloatTensor(FRAMES).swapaxes(1, 3).swapaxes(2, 3).reshape(1, len(FRAMES), 3, 480, 640)
            vid /= 255.
            writer.add_video(f"generation: {gen_num} - individual #{ind}", vid)
        asyncio.run(frames_to_video(timestep, ind, gen_num))

    return reward
