/**
 * About.tsx
 * ------------------------------------------------------------------
 * A short intro blurb plus a purely decorative fake terminal card styled
 * to look like a real shell session (static content only; not an actual interactive terminal).
 * ------------------------------------------------------------------
 */
function About() {
    return (
        <>
            {/* Short description of the unit */}
            <div id="description" className="about-intro">
                This project is made for the unit SIT313 - Full Stack Development: Secure Frontend Applications.
            </div>
            {/* Profile photo + terminal-style bio card */}
            <div id="about" className="about-layout">
                {/* Profile picture */}
                <div>
                    <img src="images/profile.png" alt="Profile" className="profile-image" />
                </div>
                {/* Fake terminal card */}
                <div id="terminal-card" className="terminal-card">
                    {/* Terminal title bar with traffic-light buttons (styled via .terminal-bar span:nth-child in App.css) */}
                    <div className="terminal-bar">
                        <span></span><span></span><span></span>
                        <span className="terminal-label">terminal</span>
                    </div>
                    {/* Terminal body content - each "command" line is followed by its "output" paragraph */}
                    <div id="terminal-body" className="terminal-body">
                        <p className="command">
                            <span className="prompt">root@timmy</span><span>:~# </span>
                            <span className="command-name">sudo </span><span>whoami</span>
                        </p>
                        <p className="terminal-heading">
                            Timmy Nguyen - Bachelor of Information Technology
                        </p>
                        <p className="command">
                            <span className="prompt">root@timmy</span><span>:~# </span><span className="command-name">cat </span><span>about.txt</span>
                        </p>
                        <p className="terminal-copy">
                            I am a full-stack developer based in Melbourne, Australia.
                            I enjoy building software solutions and exploring both
                            frontend and backend technologies.
                        </p>

                        <p className="command">
                            <span className="prompt">root@timmy</span><span>:~# </span><span className="command-name">cat </span><span>hobbies.txt</span>
                        </p>
                        <p className="terminal-copy">
                            I am also a maimai player!{" "}
                            <img src="images/maimai.png" alt="maimai" className="terminal-icon" />
                        </p>
                        {/* Trailing prompt + blinking cursor, purely decorative */}
                        <p>
                            <span className="prompt">root@timmy</span><span>:~# </span><span className="terminal-cursor"></span>
                        </p>
                    </div>
                </div>
            </div>
        </>
    )
}

export default About;