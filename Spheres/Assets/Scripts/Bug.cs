using System;
using System.Timers;
using System.Threading;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class Bug : MonoBehaviour
{
    [SerializeField]
    private float maxAge = 100f;

    [SerializeField]
    public float energy = 100f;

    private float age;

    private void OnCollisionEnter (Collision collision) {
        
        if (collision.gameObject.CompareTag("Food") )
        {
            eatEnergy(10);
        }
    }

    public void eatEnergy(float e){
            maxAge += e;
            energy += e;
    }

    private void OnEnable() {
        age = 0f;
        // TODO 
        maxAge = 200;
        energy = 10;
    }

    // Start is called before the first frame update
    void Start()
    {
    }

    // Update is called once per frame
    void Update()
    {
        age += Time.deltaTime;
        if (age >= maxAge || energy <= 0)
        {
            gameObject.GetComponent<BugController>().Reset();
            BasicPool.Instance.AddToPool(gameObject);
        }
    }
}
