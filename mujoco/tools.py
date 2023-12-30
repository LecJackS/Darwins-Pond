from dm_control_local import suite
from curses.ascii import isdigit
import random
import numpy as np
from environment import run_env
from joblib import Parallel, delayed
from tqdm import tqdm

def get_score(chrom, ind, mode, gen_num):
    s = None
    if mode=="trivial":
        s = np.sum(chrom)
    if mode=="pi":
        pi = np.asarray([digit for digit in str(np.pi)[:len(chrom)+1] if digit.isdigit()]).astype(int)
        dif = np.abs(pi - np.asarray(chrom).astype(int))
        s0 = [x*0.1**i for i, x in enumerate(dif)]
        s = -sum(s0)

    if mode=="mujoco":
        #env = suite.load('swimmer', 'swimmer6', visualize_reward=True)  #, task_kwargs={"random": 123})
        env = None
        s = run_env(chrom, ind=ind, env=env, gen_num=gen_num)

    return s

def score(ind, chrom, gen_num):
    # floating number between 0 and 1. The better the chromosome, the closer to 1
    # We coded the get_score(chrom) in the previous exercise
    return get_score(chrom, ind=ind, mode="mujoco", gen_num=gen_num)

def selection(chromosomes, gen_num, amount=0.5, num_cpus=8):
    GRADED_RETAIN_PERCENT = amount * 3 / 5  # percentage of retained best fitting individuals
    NONGRADED_RETAIN_PERCENT = amount * 2 / 5  # percentage of retained remaining individuals (randomly selected)
    # TODO: implement the selection function
    #  * Sort individuals by their fitting score
    #  * Select the best individuals
    #  * Randomly select other individuals
    num_total = chromosomes.shape[0]

    num_best = int(num_total * GRADED_RETAIN_PERCENT)
    num_rand = int(num_total * NONGRADED_RETAIN_PERCENT)

    use_single_thread = False
    if use_single_thread:
        # Single thread
        scores = np.asarray([score(i, c, gen_num) for i, c in tqdm(enumerate(chromosomes))])
    else:
        # Parallel computation
        scores = Parallel(n_jobs=num_cpus)(delayed(score)(i, x, gen_num) for i, x in tqdm(zip(np.arange(0, num_total), chromosomes)))

    sorted_ind = np.flip(np.argsort(scores))

    sorted_chroms = chromosomes[sorted_ind]

    best = sorted_chroms[:num_best]

   # print(sorted_chroms[num_best:])

    rand_ind = np.random.choice(np.arange(num_best, num_total), size=num_rand, replace=False)

    rand = sorted_chroms[rand_ind]

    return np.concatenate([best, rand]), np.asarray(scores)[sorted_ind]

def crossover(parent1, parent2):
    # TODO: implement the crossover function
    #  * Select half of the parent genetic material
    #  * child = half_parent1 + half_parent2
    #  * Return the new chromosome
    #  * Genes should not be moved
    shape = parent1.shape
    parent1 = parent1.flatten()
    parent2 = parent2.flatten()

    num_total = len(parent1) // 2

    mask = np.random.choice(a=[True, False], size=len(parent1))

    child = parent1
    child[mask] = parent2[mask]
    child = child.reshape(shape)

    #child = np.concatenate([parent1[:num_total],  parent2[num_total:]]).reshape(shape)
    
    return child

def mutation(chrom, p=0.01):
    # TODO: implement the mutation function
    #  * Random gene mutation : a character is replaced
    chrom_shape = chrom.shape
    #num_total = np.prod(chrom.shape)
    
    mutation_mask = np.random.choice(a=[True, False], size=chrom_shape, p=[p, 1-p])
    rand_matrix = np.random.uniform(-5, 5, chrom_shape) #* 0.1

    new_chrom = chrom

    # Delete all values, prepare to mult with random value
    new_chrom[mutation_mask] = 1
    # Delete unused random values, put ones instead (null of product)
    rand_matrix[~mutation_mask] = 1

    # Set some (or any) random values to a random value
    new_chrom = new_chrom * rand_matrix


    return new_chrom
