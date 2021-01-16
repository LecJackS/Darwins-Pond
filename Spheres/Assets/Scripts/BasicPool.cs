using System.ComponentModel;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class BasicPool : MonoBehaviour
{
	[SerializeField]
	private GameObject prefab;

    [SerializeField]
	private FoodPool foodPoolInstance;

    [SerializeField]
    public int num_active;

	private Queue<GameObject> availableObjects = new Queue<GameObject>();

	public static BasicPool Instance { get; private set; }

    private void Start()
    {
    	num_active = 0;
    }

    private void Awake()
    {
    	Instance = this;
    	GrowPool();
    }

    public GameObject GetFromPool()
    {
    	if(availableObjects.Count == 0)
    	{ 
    		GrowPool();
    	}
    	var instance = availableObjects.Dequeue();
    	instance.SetActive(true);
        num_active += 1;
    	return instance;
    }

    private void GrowPool()
    {
    	for(int i=0; i<10; i++){
    		var instanceToAdd = Instantiate(prefab);
    		instanceToAdd.transform.SetParent(transform);
    		AddToPool(instanceToAdd);
    	}
    }

    // TODO Maybe here modify shape of bug
    public void AddToPool(GameObject instance)
    {
    	instance.SetActive(false);
        num_active -= 1;
        // Recycle bug energy into FOOD pool
        // float recycled_energy = instance.GetComponent<Bug>().energy;
        // foodPoolInstance.GetComponent<FoodPool>().poolTotalEnergy += recycled_energy;

    	availableObjects.Enqueue(instance);
    }


    // Update is called once per frame
    void Update()
    {
        
    }
}
