import type { IContent } from '../types'
import ContentCard from './ContentCard'

/**
 * Tutorial.tsx
 * ------------------------------------------------------------------
 * "Read tutorials/" homepage section. Static data for now - each entry
 * is rendered via the shared ContentCard component. Structurally
 * identical to Article.tsx; only the dataset and section title differ.
 * ------------------------------------------------------------------
 */
const tutorials: IContent[] = [
    {
        image: "images/tutorial1.png",
        name: "3s+ umiyuri gameplay",
        title: "The 'Umiyuri Pattern' explained",
        description: "tbh it is really weird",
        rating: 1.67,
        author: "Timmy",
    },
    {
        image: "images/tutorial2.png",
        name: "Linear Algebra",
        title: "Orthogonality in abstract vector space",
        description: "A beginner-friendly walkthrough",
        rating: 4.9,
        author: "Simon",
    },
    {
        image: "images/tutorial3.png",
        name: "React Tutorial",
        title: "React Props",
        description: "Passing data between components made simple",
        rating: 4.75,
        author: "Aaron",
    },
]

function Tutorial() {
    return (
        <div id="tutorials" className="section">
            <h2 className="section-title">
                <span className="accent">$</span> read tutorials/
            </h2>
            <div className="content-grid">
                {tutorials.map((tutorial) => (
                    <ContentCard
                        key={tutorial.title}
                        image={tutorial.image}
                        name={tutorial.name}
                        title={tutorial.title}
                        description={tutorial.description}
                        rating={tutorial.rating}
                        author={tutorial.author}
                    />
                ))}
            </div>
        </div>
    )
}

export default Tutorial