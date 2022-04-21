/*
 * @name Shake Ball Bounce
 * @description Create a Ball class, instantiate multiple objects, move it around the screen, and bounce when touch the edge of the canvas.
 * Detect shake event based on total change in accelerationX and accelerationY and speed up or slow down objects based on detection.
 */
let population = [];
let alive = [];
let gen_num = 0;

let LIFE = 1000;
let NUM_AGENTS = 1000;

let TEMP_GLOBAL = 0;

// TODO: Save screenshot at the end of each generation (to make an animation later, or show previous gens at a bottom preview window )

let floor_mat = [];

let animate = true;

let threshold = 30;
let accChangeX = 0;
let accChangeY = 0;
let accChangeT = 0;

let W,H;


p5.Graphics.prototype.remove = function() {
  if (this.elt.parentNode) {
    this.elt.parentNode.removeChild(this.elt);
  }
  var idx = this._pInst._elements.indexOf(this);
  // console.log(this._pInst);
  if (idx !== -1) {
    this._pInst._elements.splice(idx, 1);
  }
  for (var elt_ev in this._events) {
    this.elt.removeEventListener(elt_ev, this._events[elt_ev]);
  }
};

function array_of_n(n, val){
  x = [];
  for (let i = 0; i < n; i++) {
    x.push(val);
  }
  return x;
}

function matrix_of(val, n_rows, n_cols){
  m = [];
  
  for(let i=0; i < n_rows; i++ ){
    m[i] = [];
    for(let j=0; j < n_cols; j++) {
      m[i][j] = val;
    }
  }
  return m;
}

function setup() {
  W = int(displayWidth/2);
  H = int(displayHeight/2);
  
  console.log(W,H);
  createCanvas(W, H);
  //floor_mat = array_of_n(w, array_of_n(h, 0));
  //floor_mat = matrix_of(0, H, W);

  background(0);

   //for (let i = 0; i < 20; i++) {
    // population.push(new Ball());
  //}
  
  num_agents = NUM_AGENTS;
  
  population = create_population(num_agents, 2);
  alive = array_of_n(num_agents, true);
  gen_num += 1;
  
  //save('myCanvas'+str(gen_num)+'png');

  const thumbs = [];
  const img = get();
  thumbs.push(img);
  console.log(thumbs)

  //img.save(gen_num, '.png');
  //textSize(32);
  //text('gen: '+gen_num, 10, 30);
  
  //console.log(floor_mat);
}

function getSum(a, b) {
  return a + b;
}

function changeAnimate(){
  animate = !animate;
}

function draw() {
  // Uncomment to see only points
  //clear();
  //background(0);

  textSize(32);
  stroke(255, 255/2);
  strokeWeight(2);
  text("gen: "+str(gen_num), 10, 30);
  //button = createButton('Animate');
  //button.position(0, 0);
  //button.mousePressed(changeAnimate);
  //background(0);
  //console.log("Draw");
  //console.log(population.length);

  

  for (let i = 0; i < population.length; i++) {
    if (alive[i]){
      if(animate){
        
        stroke(population[i].r, population[i].g, population[i].b, 255);
        strokeWeight(1);
        point(population[i].x, population[i].y);
      }
      // Save step on floor
      //console.log(floor_mat)
      //console.log(population[i].x)
      //console.log(population[i].y)

      //console.log(population[i])

      population[i].move();
      population[i].turn();
      alive[i] = (population[i].life > 0);

      if(gen_num>=3){
        //console.log(population[i].dna.genes)
      }
    }


    //population[i].display();
  }
  
  if (alive.reduce(getSum) == 0){
    // All dead, start new population
    
    //console.log("All dead");
    //population[i].compute_fitness();
    population = algorithm(population);
    alive = array_of_n(num_agents, true);
    // console.log("Best population");
    //saveCanvas('myCanvas'+str(gen_num), 'png');
    clear();
    background(0);
    //floor_mat = matrix_of(0, W, H);
    gen_num += 1;
    TEMP_GLOBAL = gen_num;
    //console.log("gen: "+str(gen_num));
    
  }

 
}



// Ball class
// Score/Fitness: 
//     Use linear distance traveled from starting point 
//     Time alive (indirectly promotes eating)
// Draw walked path


class DNA {
  constructor(genes=null){
    //console.log("genes");
    //console.log(genes);
    if (genes==null){
      this.genes = [0, 0];
      for (let i = 0; i < this.genes.length; i++){
        this.genes[i] = this.get_random_gene();
      }
      // console.log(this.genes);
    }
    else{
      //console.log(genes);
      this.genes = genes;
      this.mutate()
    }
    
    // Computed at the end of its life
    this.fitness = 0;
  }

  get_random_gene(){
    return ( (random(-5,5)) * PI / 180 );
  }

  mutate(){
    //  * Random gene mutation : random gene with prob p

    let p = 0.01;

    for (let i=0; i < this.genes.length; i++){
      if (random(0.0, 1.0) < p){
        this.genes[i] = this.get_random_gene();
      }
    }
  }
}

class Angle {
  constructor(value=0){
    this.value = value % (2 * PI);
  }

  add(v) {
    this.value = (this.value + v) % (2 * PI);
  }
}

class Ball {
  constructor(genes) {
    this.x = random(width);
    this.y = random(height);
    this.diameter = random(10, 30);
    
    this.start_dir = random(0, 2*PI);
    this.front_dir = this.start_dir; //random(0, 2*PI);
    
    this.xspeed = random(-2, 2);
    this.yspeed = random(-2, 2);
    this.oxspeed = this.xspeed;
    this.oyspeed = this.yspeed;

    //this.direction = 0.7;

    this.dna = new DNA(genes);
    this.life = LIFE;
    
    this.r = random(0, 255);
    this.g = random(0, 255);
    this.b = random(0, 255);

    this.move_dir = this.dna.genes[0] + this.dna.genes[1];
    
    

  }
  get_fitness(){
    return this.dna.fitness;
  }

  white_floor(){
    let px = get(this.x, this.y);
    return px[0] > 230 && px[1] > 230 && px[2] > 230;
  }

  penalty_dif_color_floor(){
    /*
    let er = 25;
    let px = get(this.x, this.y);

    r_top = min(255, this.r + er);
    r_bot = max(0, this.r - er);
    g_top = min(255, this.g + er);
    g_bot = max(0, this.g - er);
    b_top = min(255, this.b + er);
    b_top = max(0, this.b - er);

    px[0] > () && px[1] > 230 && px[2] > 230;
      */
    let px = get(this.x, this.y);
    return 1 - 1/(3*255) * (abs(px[0] - this.r) + abs(px[1] - this.g) + abs(px[2] - this.b));
  }

  dark_floor(){
    /*
    let er = 25;
    let px = get(this.x, this.y);

    r_top = min(255, this.r + er);
    r_bot = max(0, this.r - er);
    g_top = min(255, this.g + er);
    g_bot = max(0, this.g - er);
    b_top = min(255, this.b + er);
    b_top = max(0, this.b - er);

    px[0] > () && px[1] > 230 && px[2] > 230;
      */
    let px = get(this.x, this.y);
    return 1 - 1/(3*255) * (px[0] + px[1] + px[2]);
  }
  
  get_floor_value(){
    return floor_mat[int(this.y)][int(this.x)];
  }

  set_floor_value(){
    floor_mat[int(this.y)][int(this.x)] = 1;
  }


  move() {
    
    //console.log(this.move_dir*360/(2*PI))
    //let actions = [-3, 0, 3];
    //this.x += random(actions);
    //this.y += random(actions);
    
    this.front_dir = (this.front_dir + this.move_dir) % (2 * PI);
    let step_dir = p5.Vector.fromAngle(this.front_dir);

    this.x = min(width-1, max(0, this.x + step_dir.x));
    this.y = min(height-1, max(0, this.y + step_dir.y));
    
    if (this.front_dir == NaN){
      console.log("IS NAAAAAAAN")
    }

    //console.log(get(this.x, this.y))
    //console.log(int(this.white_floor()));
    //this.dna.fitness += 1 - int(this.white_floor());
    //console.log("floor_mat[int(this.x)][int(this.y)]");
    //console.log(floor_mat[int(this.x)][int(this.y)]);
    //let a = floor_mat[int(this.x)];
    //if (floor_mat[int(this.x)] === undefined){
    //  console.log("ERRORRRR")
    //  console.log(int(this.x))
    //  console.log(floor_mat)
    //}
    //let b = floor_mat[int(this.x)][0];
    //let penalty = int(this.white_floor());
    //let penalty = this.get_floor_value();
    //let penalty = this.penalty_dif_color_floor();
    // Step on floor and save a 1
    //this.set_floor_value();
    //this.dna.fitness = min(LIFE, this.dna.fitness + 1 - penalty);
    this.dna.fitness = min(LIFE, this.dna.fitness + this.dark_floor());
    this.life -= 1;

    //this.move_dir = this.dna.get_random_gene() + this.dna.get_random_gene()

//console.log("this.dna.fitness");
    //console.log(this.dna.fitness);
    
    //console.log(step_dir);
    //console.log();
  }

  // Bounce when touch the edge of the canvas
  turn() {
    if (this.x <= 1 || this.y <= 1 || this.x >= width - 1 || this.y >= height - 1){
      this.life = 0;
      this.fitness /= 2;
    }
  }

  // Add to xspeed and yspeed based on
  // the change in accelerationX value
  shake() {
    this.xspeed += random(5, accChangeX / 2);
    this.yspeed += random(5, accChangeX / 3);
  }

  // Gradually slows down
  stopShake() {
    if (this.xspeed > this.oxspeed) {
      this.xspeed -= 0.6;
    } else {
      this.xspeed = this.oxspeed;
    }
    if (this.yspeed > this.oyspeed) {
      this.yspeed -= 0.6;
    } else {
      this.yspeed = this.oyspeed;
    }
  }

  display() {
    ellipse(this.x, this.y, this.diameter, this.diameter);
  }


  // Genetic code

  

  get_score(){
    /*
    let key = get_answer();
    // TODO: implement the scoring function
    //  * compare the chromosome with the solution (how many character are in the correct position?)
    let n = len(chrom);
    corrects = 0.;
    for (c, k in zip(chrom, key)){
      corrects += (c == k);
    }
        

    return corrects / n;
    */
    return this.dna.fitness;
  }
  

  score(){
    // floating number between 0 and 1. The better the chromosome, the closer to 1
    // We coded the get_score(chrom) in the previous exercise
    return get_score();
  }
  



  get_letter(){
    return random(this.alphabet)
  }


  create_chromosome(size){
    // TODO: Create a chromosome as a string of the right size
    let chromosome = "";
    //chromosome = chromosome.join([get_letter() for i in range(size)]);
    return chromosome;
  }
  
  

  mutation(chrom){
    // TODO: implement the mutation function
    //  * Random gene mutation : random gene with prob p

    let p = 0.01;
    let num_total = chrom.length;
    let new_chrome = chrom;

    for (let i=0; i < chrom.length; i++){
      if (random(0.0, 1.0) < p){
        new_chrome[i] = get_letter()
        //new_chrome += get_letter()
      }
      //else {
      //  new_chrome += c
      //}
    }
    return new_chrome
  }
  


}

function crossover(genes_1, genes_2) {
  // TODO: implement the crossover function
  //  * Select half of the parent genetic material
  //  * child = half_parent1 + half_parent2
  //  * Return the new chromosome
  //  * Genes should not be moved
  //if (TEMP_GLOBAL >= 3){
  //  noLoop()
  //}
  
  let num_total = genes_1.dna.genes.length;
  let child_genes = [];
  for (let i=0; i < num_total; i++){
    if(random(true, false)){
      child_genes.push(genes_1.dna.genes[i]);
    }
    else{
      child_genes.push(genes_2.dna.genes[i]);
      
    }
    
  }

  return child_genes;
}

function selection(chromosomes_list) {
    let GRADED_RETAIN_PERCENT = 0.3;     // percentage of retained best fitting individuals
    let NONGRADED_RETAIN_PERCENT = 0.2;  // percentage of retained remaining individuals (randomly selected)
    // TODO: implement the selection function
    //  * Sort individuals by their fitting score
    //  * Select the best individuals
    //  * Randomly select other individuals
    let num_total = chromosomes_list.length;
    let num_best = int(num_total * GRADED_RETAIN_PERCENT);
    let num_rand = int(num_total * NONGRADED_RETAIN_PERCENT);

    let scores = [];
    //console.log(chromosomes_list.length);
    for (let i=0; i < chromosomes_list.length; i++){
      //scores.score(c);
      //console.log("for 1")
      //console.log(chromosomes_list[i].get_fitness())
      scores.push(chromosomes_list[i].get_fitness())
    }
    //// console.log("chromosomes_list 1");
    //console.log(chromosomes_list);
  
    //console.log("scores 1");
    //console.log(scores);
  

    
    //let sorted_chroms = [];
    
    //for z, c in sorted(zip(scores, chromosomes_list), reverse=True)]

    let individuals = scores.map(function(score, i){
      return [score, chromosomes_list[i]];
    });
  
    //console.log("individuals 1");
    //console.log(individuals);

    // Sorting tuples by score (ie. first dimension)
    individuals.sort(function compareFn(a, b) {
      // Sort DECreasingly
      return (b[0] - a[0]);
    });
      
    
    //console.log("sorted_chroms");
  //console.log(sorted_chroms);
  //console.log(num_best);
    let best = individuals.slice(0, num_best);
  
  //console.log("Sorted scores:");
  //console.log(sorted_scores);
  
  //console.log("best");
  //console.log(best);

    let rand = [];
    for (let i=0; i < num_rand; i++){
      rand.push(random(individuals.slice(num_best, individuals.length)));
    }
    //console.log("best.concat(rand)");
    //console.log(best.concat(rand));

    let sel = [];

    for (let i = 0; i< best.length; i++){
      sel.push(best[i][1]);
    }

    for (let i = 0; i < rand.length; i++){
      sel.push(rand[i][1]);
    }
    //console.log(sel);

    return sel;
  }


function create_population(pop_size, chrom_size) {
    // use the previously defined create_chromosome(size) function
    // TODO: create the base population

    let pop = [];

    for(let i = 0; i < pop_size; i++){
      pop.push(new Ball())
    }
    
    return pop;
}



function generation(population){
    // selection
    // use the selection(population) function created on exercise 2
   // console.log(population);
    let sel_pop = selection(population);
    //console.log("sel_pop");
    //console.log(sel_pop);

    //print(select)
    
    // reproduction
    // As long as we need individuals in the new population, fill it with children
    let children = [];
    // TODO: implement the reproduction
    let genes_parent1 = new Ball();
    let genes_parent2 = new Ball();
    //let child = new Ball();
    let child_genes = [];
    while (children.length < population.length - sel_pop.length){
        //// crossover
        //parent1 = ??? // randomly selected
        //parent2 = ??? // randomly selected
        genes_parent1 = random(sel_pop);
        genes_parent2 = random(sel_pop);

        // use the crossover(parent1, parent2) function created on exercise 2
        child_genes = crossover(genes_parent1, genes_parent2);
       //console.log("genes child");
       //console.log(genes);
     // console.log(child);
        //// mutation
        children.push(new Ball(child_genes));
    }
      
    
    // return the new generation
 // console.log("sel_pop.concat(children)");
 // console.log(sel_pop.concat(children));
    return sel_pop.concat(children);
}

function algorithm(population){
    //chrom_size = int(2)
    //population_size = 16
    
    // create the base population
    //let population = create_population(population_size, chrom_size)
    
    //answers = [];
    
    population = generation(population);
    /*
    // while a solution has not been found :
    //while (array.length === 0) {
    while (true) {
        //// create the next generation
        // TODO: create the next generation using the generation(population) function
        population = generation(population)
        
        //// display the average score of the population (watch it improve)
        //print(get_mean_score(population), file=sys.stderr)
    
        //// check if a solution has been found
        //for (chrom in population){
        //  if (is_answer(chrom)){
        //    answers.append(chrom)
        //  }
        //}
    }
    */
    // TODO: print the solution
    return population;
  }
  