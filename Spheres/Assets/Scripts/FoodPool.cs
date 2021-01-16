using System.ComponentModel;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class FoodPool : MonoBehaviour
{
	[SerializeField]
	private GameObject prefab;

	[SerializeField]
	public float poolTotalEnergy = 100f; 

	private Queue<GameObject> availableObjects = new Queue<GameObject>();

	public static FoodPool Instance { get; private set; }

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

		float full_energy = 20;
		float new_energy;
		if ( (poolTotalEnergy - full_energy) >= 0 )
		{
			new_energy = full_energy;
		}
		else
		{
			new_energy = full_energy - (full_energy - poolTotalEnergy);
		}
		

		Food food = instance.GetComponent<Food>();
		food.energy = new_energy;
		poolTotalEnergy -= new_energy;

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

    public void AddToPool(GameObject instance)
    {
    	instance.SetActive(false);
		Food food = instance.GetComponent<Food>();
		float return_energy = food.full_energy;
		//poolTotalEnergy += return_energy;
    	availableObjects.Enqueue(instance);
    }

    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
