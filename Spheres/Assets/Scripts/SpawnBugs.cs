using System.Diagnostics;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class SpawnBugs : MonoBehaviour
{
    [SerializeField]
    private float delay = 0.001f;
    [SerializeField]
    private GameObject bugPrefab;

    private int maxNumActive = 5;

    private float lastTime;

    // Start is called before the first frame update
    void Start()
    {
        for (int i = 0; i < maxNumActive; i++)
        {
            SpawnBugFromPool();            
        }
    }

    // Update is called once per frame
    private void Update()
    {
        int num_active = BasicPool.Instance.num_active;

        if (num_active < maxNumActive)
        {
            SpawnBugFromPool();
        }
        /*if (Time.time - lastTime > delay)
        {
            //SpawnBugFromPool();
        }*/
    }

    private void SpawnBugFromPool()
    {
        lastTime = Time.time;

        Vector3 position = RandomPointInBox(transform.position, transform.localScale);

        var bug = BasicPool.Instance.GetFromPool();
        bug.transform.position = position;
        bug.GetComponent<Bug>().energy = 101;
    }

    private static Vector3 RandomPointInBox(Vector3 center, Vector3 size)
    {
        var noise = new Vector3((UnityEngine.Random.value - 0.5f) * 2 * size.x,
                                (UnityEngine.Random.value - 0.5f) * 2 * size.y,
                                (UnityEngine.Random.value - 0.5f) * 2 * size.z);
        return center + noise;
    }
}
