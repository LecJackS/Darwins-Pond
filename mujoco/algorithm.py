import random
import sys
# You can redefine these functions with the ones you wrote previously.
# Another implementation is provided here.
import time

from tools import selection, crossover, mutation
import numpy as np
import json
import aioconsole

def create_chromosome(size):
    #chromosome = [random.uniform(0, 9.99999) for _ in range(size)]

    chromosome = np.random.uniform(-5, 5, size) #* 0.1

    chromosome[0, :] = abs(chromosome[0, :])

    return chromosome

def create_population(pop_size, chrom_size):
    # use the previously defined create_chromosome(size) function
    # TODO: create the base population
    # chrom = create_chromosome(chrom_size)
    return np.asarray([create_chromosome(chrom_size) for i in range(pop_size)])

async def add_external(shape):
    line = await aioconsole.ainput('Input matrix of genomes: ')
    try:
        new_chrom = np.fromstring(line)
        if new_chrom == shape:
            # Invalid dimensions
            new_chrom = None
        pass
    except:
        new_chrom = None
        pass
    return new_chrom

def generation(population, gen_num, input_chrom):
    # selection
    # use the selection(population) function created on exercise 2
    selected, scores = selection(population, gen_num, amount=0.5)

    if input_chrom:
        print("Inserting input chrom:")
        print(input_chrom)
        selected[-1] = input_chrom

    # reproduction
    # As long as we need individuals in the new population, fill it with children
    children = []
    # TODO: implement the reproduction

    while len(children) < len(population) - len(selected):
        ## crossover
        # parent1 = ??? # randomly selected
        # parent2 = ??? # randomly selected
        rand_ind = np.random.choice(np.arange(0, len(selected)), size=2, replace=False)
        parent1, parent2 = selected[rand_ind]
        # use the crossover(parent1, parent2) function created on exercise 2
        child = crossover(parent1, parent2)

        ## mutation
        # use the mutation(child) function created on exercise 2
        child = mutation(child)
        child[0, :] = abs(child[0, :])
        children.append(child)

    # return the new generation
    return np.concatenate([selected, children]), scores

def print_scores(scores):
    N = 20
    max_s = max(scores)
    dif = max(scores[:N]) - min(scores[:N])
    dif = max(0.001, dif)
    for s in scores[:N]:
        print("|" * int(( (1 - (max_s - s)/dif) * 50)), s)
    print()

def algorithm():
    world = {}
    chrom_size = (1+2+2+1, 4) # bias, 2 signals, 2 arg value_for_inside_sin()
    population_size = 8 * 8 * 8 # (8 cores)
    M = 10
    SAVE_GEN_EVERY = 100
    # create the base population
    load_file = True
    if load_file:
        with open('world_data/world.json', 'r') as fp:
            s = fp.read()
            world = json.loads(s)
            population = np.asarray(world['last_population'])
            gen_num = world['last_gen_num']

            print(population.shape)
            print(gen_num)
    else:
        population = create_population(population_size, chrom_size)
        print(population.shape)
        world['last_population'] = population.tolist()

        gen_num = 0
        world['last_gen_num'] = gen_num

    answers = []
    # while a solution has not been found :
    shape = population[-1].shape
    #input_chrom = asyncio.run(add_external(shape))
    input_chrom = None

    # print(select)

    while not answers:
        ## create the next generation
        # TODO: create the next generation using the generation(population) function
        population, scores = generation(population, gen_num, input_chrom)
        world['last_population'] = population.tolist()

        with open('world_data/world.json', 'w') as fp:
            fp.write(json.dumps(world))

        if gen_num % SAVE_GEN_EVERY == 0:
            with open('world_data/world_gen{:08}.json'.format(gen_num), 'w') as fp:
                fp.write(json.dumps(world))

        if gen_num % 1 == 0:
            #print("{} - {} - {}".format(population[0], population[1], population[2]))
            print(f"\nGeneration: {gen_num} - Same env: {gen_num//M}/{M}", )
            print(f"Cycle lens: {[int(sum(ind[0, :]) * 100) for ind in population] }")
            print("Scores:")
            print(scores)
            print_scores(scores)
            #print("{}".format(np.asarray(population[0])))
            print()

        ## display the average score of the population (watch it improve)
        # print(get_mean_score(population), file=sys.stderr)

        ## check if a solution has been found
        # for chrom in population:
        #     if is_answer(chrom):
        #         answers.append(chrom)
        gen_num += 1
        world['last_gen_num'] = gen_num
        if gen_num > 100000:
            print("Fin.")
            break

    # TODO: print the solution
    return world


if __name__ == "__main__":
    print("Starting...")

    time_start = time.time()
    algorithm()
    time_end = time.time()
    print("Duration:", round(time_end - time_start), "secs")