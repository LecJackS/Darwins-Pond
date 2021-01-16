using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class NewBehaviourScript : MonoBehaviour
{
	public float forceValue;
	private Rigidbody rb;

    // Start is called before the first frame update
    void Start()
    {
        rb = GetComponent<Rigidbody>();
    }

    // Update is called once per frame
    void Update()
    {
        // transform.Translate(Input.GetAxis("Horizontal") * speed * Time.deltaTime,
        // 					0,
        // 					Input.GetAxis("Vertical") * speed * Time.deltaTime);
    }

    private void FixedUpdate()
    {
    	rb.AddForce(new Vector3(Input.GetAxis("Horizontal") * forceValue,
         						0,
         						Input.GetAxis("Vertical") * forceValue));
    }
}
