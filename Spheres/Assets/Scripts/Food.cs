using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class Food : MonoBehaviour
{

	[SerializeField]
    public float full_energy = 100f;

	public float energy = 100f;


	private void OnEnable() {
        full_energy = 100f;
        energy = full_energy;
    }

    private void OnCollisionEnter (Collision collision) {
        
        if (collision.gameObject.CompareTag("Bug") )
        {
            if(energy - 10 > 0)
            {
                energy -= 10;
            }
            else
            {
                energy = 0;
                Recycle();
            }
            
        }
    }

    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Recycle()
    {
        FoodPool.Instance.AddToPool(gameObject);
    }
}
