using System.Diagnostics;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class SpawnFood : MonoBehaviour
{
    [SerializeField]
    private float delay = 0.001f;

    [SerializeField]
    private GameObject foodPrefab;

    private float lastTime;

    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    private void Update()
    {
        if ((Time.time - lastTime > delay) && (FoodPool.Instance.poolTotalEnergy > 0))
        {
            SpawnFoodFromPool();
        }
    }

    private void SpawnFoodFromPool()
    {
        lastTime = Time.time;

        Vector3 position = RandomPointInBox(transform.position, transform.localScale);

        var food = FoodPool.Instance.GetFromPool();
        food.transform.position = position;
    }

    private static Vector3 RandomPointInBox(Vector3 center, Vector3 size)
    {
        var noise = new Vector3((UnityEngine.Random.value - 0.5f) * 4 * size.x,
                                (UnityEngine.Random.value - 0.5f) * 4 * size.y,
                                (UnityEngine.Random.value - 0.5f) * 4 * size.z);
        return center + noise;
    }
}
