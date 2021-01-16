using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class BugPooled : MonoBehaviour
{
	[SerializeField]
	private float birthRate = 2f;

	private float birthTimer = 0;

    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        birthTimer += Time.deltaTime;
        if (birthTimer >= birthRate)
        {
        	birthTimer = 0;
        	Born();
        }
    }

    private void Born()
    {
    	var bug = BasicPool.Instance.GetFromPool();
    	bug.transform.rotation = transform.rotation;
    }
}
