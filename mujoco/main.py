from json.tool import main
from dm_control import suite
import numpy as np
from PIL import Image
import subprocess
import matplotlib.animation as animation
import matplotlib.pyplot as plt

class Swimmer(suite.base.Task):
  """A swimmer `Task` to reach the target or just swim."""

  def __init__(self, random=None):
    """Initializes an instance of `Swimmer`.

    Args:
      random: Optional, either a `numpy.random.RandomState` instance, an
        integer seed for creating a new `RandomState`, or None to select a seed
        automatically (default).
    """

    super().__init__(random=random)

  def initialize_episode(self, physics):
    """Sets the state of the environment at the start of each episode.

    Initializes the swimmer orientation to [-pi, pi) and the relative joint
    angle of each joint uniformly within its range.

    Args:
      physics: An instance of `Physics`.
    """
    # Random joint angles:
    suite.swimmer.randomizers.randomize_limited_and_rotational_joints(physics, self.random)
    # Random target position.
    close_target = self.random.rand() < .2  # Probability of a close target.
    target_box = .5 #.3 if close_target else 2
    #xpos, ypos = self.random.uniform(-target_box, target_box, size=2)
    angle = self.random.uniform(0, 2 * np.pi)
    xpos = target_box * np.cos(angle)
    ypos = target_box * np.sin(angle)
    physics.named.model.geom_pos['target', 'x'] = xpos
    physics.named.model.geom_pos['target', 'y'] = ypos
    physics.named.model.light_pos['target_light', 'x'] = xpos
    physics.named.model.light_pos['target_light', 'y'] = ypos

    #physics.named.model.geom_pos['head', 'x'] = xpos
    #physics.named.model.geom_pos['head', 'y'] = ypos

    print("physics.named.model.geom_pos", physics.named.model.geom_pos)


    super().initialize_episode(physics)

  def get_observation(self, physics):
    """Returns an observation of joint angles, body velocities and target."""
    obs = suite.collections.OrderedDict()
    obs['joints'] = physics.joints()
    obs['to_target'] = physics.nose_to_target()
    obs['body_velocities'] = physics.body_velocities()
    return obs

  def get_reward(self, physics):
    """Returns a smooth reward."""
    target_size = physics.named.model.geom_size['target', 0]
    return suite.swimmer.rewards.tolerance(physics.nose_to_target_dist(),
                             bounds=(0, target_size),
                             margin=5*target_size,
                             sigmoid='long_tail')



def _make_swimmer(n_joints, time_limit=suite.swimmer._DEFAULT_TIME_LIMIT, random=None,
                  environment_kwargs=None):
  """Returns a swimmer control environment."""
  model_string, assets = suite.swimmer.get_model_and_assets(n_joints)
  physics = suite.swimmer.Physics.from_xml_string(model_string, assets=assets)
  task = Swimmer(random=random)
  environment_kwargs = environment_kwargs or {}
  return suite.control.Environment(
      physics, task, time_limit=time_limit, control_timestep=suite.swimmer._CONTROL_TIMESTEP,
      **environment_kwargs)


if __name__ == "__main__":

    @suite.swimmer.SUITE.add('benchmarking')
    def swimmer10(time_limit=suite.swimmer._DEFAULT_TIME_LIMIT, random=None,
                  environment_kwargs=None):
        """Returns a 10-link swimmer."""
        return _make_swimmer(5, time_limit, random=random,
                             environment_kwargs=environment_kwargs)




    # Load one task:
    env = suite.load('swimmer', 'swimmer10', visualize_reward=True)

    # Iterate over a task set:
    # for domain_name, task_name in [suite.BENCHMARKING[0]]:
    #     env = suite.load(domain_name, task_name)

    # Step through an episode and print out reward, discount and observation.
    action_spec = env.action_spec()
    time_step = env.reset()


    count = 0
    i = 0
    images = []
    print(action_spec.minimum, action_spec.maximum)
    while not time_step.last():
        action = np.random.uniform(action_spec.minimum,
                                action_spec.maximum,
                                size=action_spec.shape)
        time_step = env.step(action)
        #print(time_step.reward)
        pixels = env.physics.render(width=640, height=480)#camera_id="back"
        img = Image.fromarray(pixels, 'RGB')
        # im.show()
        if count % 10 == 0:
            img.save("frames/frame-%.8d.png" % i)
            i += 1
        count += 1

        # creating a object
        #im = Image.open(r"C:\Users\System-Pc\Desktop\home.png")
        #print(time_step.reward, time_step.discount, time_step.observation)


    subprocess.call([
        'ffmpeg', '-framerate', '5', '-y', '-i', 'frames/frame-%08d.png', '-r', '30', '-pix_fmt', 'yuv420p', 'video_name.mp4'
    ])