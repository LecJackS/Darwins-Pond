using System.Collections;
using System.Collections.Generic;
using UnityEngine;

using System;

[RequireComponent(typeof(NNet))]
public class BugController : MonoBehaviour
{
    public static BugController Instance { get; private set; }
    private Vector3 startPosition, startRotation;
    private NNet network;

    [Range(-1f,1f)]
    public float a,t;

    public float timeSinceStart = 0f;

    [Header("Sensor")]
    public float maxDistance = 30f;

    [Header("Fitness")]
    public float overallFitness;
    public float distanceMultiplier = 1.4f;
    public float avgSpeedMultiplier = 0.2f;
    public float sensorMultiplier = 0.1f;
    public float stepForceValue = 100;

    [Header("Network Options")]
    public int LAYERS = 2;
    public int NEURONS = 4;

    private Vector3 lastPosition;
    private float totalDistanceTravelled;
    private float avgSpeed;

    private float aSensor;
    
    //temporal
    private NNet[] population;

    private void Awake() {
        startPosition = transform.position;
        startRotation = transform.eulerAngles;
        //network = GetComponent<NNet>();

        network = new NNet();
        network.Initialise(LAYERS, NEURONS);
    }

    public void ResetWithNetwork (NNet net)
    {
        network = net;
        Reset();
    }

    

    public void Reset() {
        CancelInvoke();
        timeSinceStart = 0f;
        totalDistanceTravelled = 0f;
        avgSpeed = 0f;
        lastPosition = startPosition;
        overallFitness = 0f;
        transform.position = startPosition;
        transform.eulerAngles = startRotation;
    }

    private void OnCollisionEnter (Collision collision) {
        //print("Collision!");
        //Death();
    }

    private void FixedUpdate() 
    {
        timeSinceStart += Time.deltaTime;

    }

    private void Start(){
        InvokeRepeating("ReadSensors", 2f, 0.5f);
    }

    private void ReadSensors(){
       
        InputSensors();

        lastPosition = transform.position;

        (a, t) = network.RunNetwork(aSensor);

        MoveBug(a, t);


        CalculateFitness();

        //a = 0;
        //t = 0;


    }

    private void Death ()
    {
        //GameObject.FindObjectOfType<GeneticManager>().Death(overallFitness, network);
        BasicPool.Instance.AddToPool(gameObject);
    }

    private void CalculateFitness() {

        //totalDistanceTravelled += Vector3.Distance(transform.position, lastPosition);
        //avgSpeed = totalDistanceTravelled/timeSinceStart;

        //overallFitness = totalDistanceTravelled * distanceMultiplier + avgSpeed * avgSpeedMultiplier + aSensor * sensorMultiplier;
        overallFitness = gameObject.GetComponent<Bug>().energy * 100;

        if (timeSinceStart > 20 && overallFitness < 40) {
            //Death();
        }

        // if (overallFitness >= 1000) {
        //     Death();
        // }

    }

    private void InputSensors() {

        // Vector3 a = (transform.forward+transform.right);
        // Vector3 b = (transform.forward);
        // Vector3 c = (transform.forward-transform.right);
        Vector3 a = (transform.forward);
        // Vector parallel to ground
        a.y = 0;

        Ray r = new Ray(transform.position, a);
        RaycastHit hit;

        if (Physics.Raycast(r, out hit, maxDistance)) {
            if(hit.collider.tag == "Food")
            {
                aSensor = hit.distance/maxDistance;
                Debug.DrawLine(r.origin, hit.point, Color.red);
            }
        }

        /* r.direction = b;

        if (Physics.Raycast(r, out hit)) {
            bSensor = hit.distance/20;
            Debug.DrawLine(r.origin, hit.point, Color.red);
        }

        r.direction = c;

        if (Physics.Raycast(r, out hit)) {
            cSensor = hit.distance/20;
            Debug.DrawLine(r.origin, hit.point, Color.red);
        } */

    }

    private Vector3 inp;
    public void MoveBug (float dx, float dz) {
        //inp = Vector3.Lerp(Vector3.zero, new Vector3(0, 0, v * 11.4f), 0.02f);
        //inp = transform.TransformDirection(inp);
        //transform.position += inp;

        //transform.eulerAngles += new Vector3(0, (h * 90) * 0.02f, 0);
        float Fx = dx * stepForceValue;
        float Fz = dz * stepForceValue;

        Vector3 new_force = new Vector3(Fx, 0, Fz);

        gameObject.GetComponent<Rigidbody>().AddForce( new_force );
        
        gameObject.GetComponent<Bug>().energy -= new_force.magnitude / 10;
    }

}
