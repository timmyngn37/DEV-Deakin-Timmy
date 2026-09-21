import { Fragment } from "react"
import type { IProject } from "../types"

/**
 * Project.tsx
 * ------------------------------------------------------------------
 * A short list of portfolio projects, each linking out to its GitHub repo.
 * ------------------------------------------------------------------
 */
const projects: IProject[] = [
    {
        image: '/images/project1.png',
        name: 'Tarot Personality Test',
        description: 'Personal project using the SplashKit library for the user interface.',
        link: 'https://github.com/timmyngn37/Tarot-PersonalityTest',
    },
    {
        image: '/images/project2.png',
        name: 'Goodminton',
        description: 'Front-end website for badminton booking services using Vue.js framework.',
        link: 'https://github.com/timmyngn37/goodminton',
    },
    {
        image: '/images/project3.png',
        name: 'Film Streaming Platform',
        description: 'Streaming platform built to practice CI/CD pipelines using Jenkins and Docker.',
        link: 'https://github.com/timmyngn37/film-streaming-platform',
    },
]

function Project() {
    return (
        <div id="work" className="project-section">
            <h2 className="project-title">
                <span className="accent">$</span> ls projects/ | head -3
            </h2>

            <div className="project-list">
                {projects.map((project) => (
                    <Fragment key={project.link}>
                        <img
                            src={project.image}
                            alt={project.name}
                            className="project-image"
                        />
                        <div>
                            <a href={project.link} target="_blank" rel="noopener noreferrer">
                                <h3 className="project-name">
                                    {project.name}
                                </h3>
                            </a>
                            <p className="project-description">{project.description}</p>
                        </div>
                    </Fragment>
                ))}
            </div>
        </div>
    )
}

export default Project