from dm_control_local import suite
import numpy as np
from PIL import Image
import subprocess



def get_action(total_observation, timestep, action_spec, chrom):
    if total_observation == None:
        action = np.random.uniform(action_spec.minimum,
                               action_spec.maximum,
                               size=action_spec.shape)
    else:
        act_dim = action_spec.shape[0]
        
        # 2d vector to target
        x_in = total_observation.observation['to_target']
        
        # Sin wave of N timesteps per cicle (agent would learn wavy-patterns)
        cycle_len = 10 # in timesteps
        t_in = np.sin(timestep / cycle_len * 2 * np.pi)
        
        # Concatenate Bias + Input values
        x_in = np.concatenate([[1, t_in], x_in])
        
        x_in_dim = len(x_in)
        # Todo: completar con la combinacion lineal de x_in contra parametros dados en chrom? o con algo intermedio
        #       notar que todavia no puedo llamar la funcion con chrom porque no existe chrom en este archivo.

        M = np.ones((x_in_dim, act_dim))*0.01
        
        #print("x_in:", x_in)
        
        action = np.tanh( np.matmul(x_in, M) )
        
        
    return action


def run_env(chrom, render=False):
    # Load one task:
    env = suite.load('swimmer', 'swimmer6', visualize_reward=True)



    # Iterate over a task set:
    # for domain_name, task_name in [suite.BENCHMARKING[0]]:
    #     env = suite.load(domain_name, task_name)

    # Step through an episode and print out reward, discount and observation.

    total_observation = env.reset()
    action_spec = env.action_spec()


    timestep = 0
    i = 0
    idx = 0
    action = np.asarray([0.] * 5)

    while not total_observation.last():
        #chrom = None # TODO Get chromosome array or matrix
        action = get_action(total_observation, timestep, action_spec, chrom)
        
        if render:
            print("action: ", action)
            idx = (idx + 1) % 5
            total_observation = env.step(action)
            pixels = env.physics.render()#camera_id="back"
            im = Image.fromarray(pixels, 'RGB')
            # im.show()
            if timestep % 10 == 0:
                im.save("frames/frame-%.8d.png" % i)
                i += 1
        timestep += 1
        
        #print(total_observation)

        
        # 0: perfect score (0 distance to target)
        #score = - np.linalg.norm(total_observation.observation['to_target'])
        reward = total_observation.reward
        # creating a object
        #im = Image.open(r"C:\Users\System-Pc\Desktop\home.png")
        #print(i, total_observation.reward)#, total_observation.discount, total_observation.observation)
        #print(count, score, "\n", total_observation.observation)#, total_observation.discount, total_observation.observation)
        

    if render:
        subprocess.call([
            'ffmpeg', '-framerate', '5', '-y', '-i', 'frames/frame-%08d.png', '-r', '30', '-pix_fmt', 'yuv420p', 'video_name.mp4'
        ])

    return reward