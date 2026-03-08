    // --- State Management ---
        let fileSystem = [];
        let flatFiles = new Map();
        let currentFileId = null;

        // --- UI Elements ---
        const setupModal = document.getElementById('setupModal');
        const loadingOverlay = document.getElementById('loadingOverlay');
        const sketchInput = document.getElementById('sketchInput');
        const fileExplorer = document.getElementById('fileExplorer');
        const codeEditor = document.getElementById('codeEditor');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        const progressBar = document.getElementById('progressBar');
        const loadingStatus = document.getElementById('loadingStatus');
        const loadingTitle = document.getElementById('loadingTitle');
        const fileNameDisplay = document.getElementById('fileNameDisplay');

        // --- 1. Generation Logic with Progress Bar ---
        function startGeneration() {
            const sketch = sketchInput.value;
            if(!sketch.trim()) return;

            closeModal();
            showLoader('Generating Structure', true);

            // Simulate processing steps for UI feedback
            updateProgress(10, 'Parsing text input...');
            
            setTimeout(() => {
                updateProgress(40, 'Creating folder hierarchy...');
                
                // Actual Parsing
                try {
                    fileSystem = parseSketch(sketch);
                    
                    setTimeout(() => {
                        updateProgress(70, 'Generating boilerplate code...');
                        renderExplorer();
                        
                        setTimeout(() => {
                            updateProgress(100, 'Finalizing...');
                            
                            setTimeout(() => {
                                hideLoader();
                                // Open first file
                                const firstFile = Array.from(flatFiles.values())[0];
                                if(firstFile) openFile(firstFile.id);
                            }, 500);
                        }, 400);
                    }, 400);

                } catch (e) {
                    alert("Error: " + e.message);
                    hideLoader();
                    openModal();
                }
            }, 800);
        }

        function startDownloadProcess() {
            if(flatFiles.size === 0) {
                alert("Generate a project first!");
                return;
            }

            showLoader('Compressing Files', false);
            updateProgress(0, 'Preparing files...');

            setTimeout(() => {
                updateProgress(50, 'Zipping content...');
                
                const zip = new JSZip();
                
                // Recursive function to build zip
                function addToZip(nodes, currentPath) {
                    nodes.forEach(node => {
                        const path = currentPath ? `${currentPath}/${node.name}` : node.name;
                        if(node.type === 'folder') {
                            zip.folder(path);
                            if(node.children) addToZip(node.children, path);
                        } else {
                            zip.file(path, node.content);
                        }
                    });
                }

                // Handle root wrapper if exists
                if(fileSystem.length === 1 && fileSystem[0].name === 'root') {
                    addToZip(fileSystem[0].children, '');
                } else {
                    addToZip(fileSystem, '');
                }

                updateProgress(80, 'Finalizing archive...');

                zip.generateAsync({type: "blob"}).then(content => {
                    updateProgress(100, 'Download started!');
                    saveAs(content, "probuilder-project.zip");
                    setTimeout(hideLoader, 1000);
                });

            }, 1000);
        }

        // --- 2. Parsing Engine ---
        function parseSketch(text) {
            const lines = text.split('\n');
            const root = { id: 'root', name: 'root', type: 'folder', children: [] };
            const stack = [{ node: root, level: -1 }];
            let idCounter = 0;
            
            flatFiles.clear(); // Reset

            lines.forEach(line => {
                if(!line.trim()) return;

                // Determine indentation
                const indentMatch = line.match(/^[\s│├└─]*/);
                const level = indentMatch ? indentMatch[0].length : 0;

                // Clean name
                let raw = line.replace(/[│├└─]/g, '').trim();
                if(!raw) return;

                // Extract comment
                let comment = '';
                if(raw.includes('#')) {
                    [raw, comment] = raw.split('#');
                    raw = raw.trim();
                    comment = comment.trim();
                }

                // Detect Type
                // If ends with / OR has no dot (assuming folder unless explicitly file)
                // But usually files have dots. Let's use dot rule + explicit slash
                const isFolder = raw.endsWith('/') || (!raw.includes('.') && raw.startsWith('/'));
                
                let name = raw.replace(/\/$/, '');
                // Remove leading slash for display
                if(name.startsWith('/') && name.length > 1) name = name.substring(1);

                const newNode = {
                    id: `f-${idCounter++}`,
                    name: name,
                    type: isFolder ? 'folder' : 'file',
                    content: isFolder ? null : createContent(name, comment),
                    children: isFolder ? [] : null
                };

                if(!isFolder) flatFiles.set(newNode.id, newNode);

                // Stack Logic
                while(stack.length > 1 && stack[stack.length - 1].level >= level) {
                    stack.pop();
                }

                const parent = stack[stack.length - 1].node;
                if(parent.children) parent.children.push(newNode);

                if(isFolder) stack.push({ node: newNode, level: level });
            });

            // If root only contains one top-level folder (like /app), return its children? 
            // Or keep it as is. Let's keep structure clean.
            if(root.children.length === 1 && root.children[0].name === 'root') {
                return root.children[0].children;
            }
            return root.children;
        }

        // --- 3. UI Rendering ---
        function renderExplorer() {
            fileExplorer.innerHTML = '';
            const container = document.createElement('div');
            
            function buildTree(nodes, parentEl, depth) {
                nodes.forEach(node => {
                    const el = document.createElement('div');
                    el.className = `tree-item`;
                    el.style.paddingLeft = `${1 + (depth * 1.2)}rem`;
                    
                    let icon = 'fa-file';
                    let color = 'text-gray';

                    if(node.type === 'folder') {
                        icon = 'fa-folder';
                        color = 'text-yellow';
                    } else {
                        if(node.name.includes('html')) { icon = 'fa-html5'; color = 'text-orange'; }
                        else if(node.name.includes('css')) { icon = 'fa-css3-alt'; color = 'text-blue'; }
                        else if(node.name.includes('js')) { icon = 'fa-js'; color = 'text-yellow'; }
                        else if(node.name.includes('json')) { icon = 'fa-code'; color = 'text-green'; }
                    }

                    el.innerHTML = `<i class="fas ${icon} ${color}"></i> ${node.name}`;

                    if(node.type === 'file') {
                        el.onclick = () => {
                            openFile(node.id);
                            // If mobile, close sidebar
                            if(window.innerWidth <= 768) toggleSidebar();
                        };
                        // Mark active if needed
                        if(currentFileId === node.id) el.classList.add('active');
                    }

                    parentEl.appendChild(el);

                    if(node.children) {
                        buildTree(node.children, parentEl, depth + 1);
                    }
                });
            }

            buildTree(fileSystem, container, 0);
            fileExplorer.appendChild(container);
        }

        function openFile(id) {
            const file = flatFiles.get(id);
            if(!file) return;

            // Save previous
            if(currentFileId && flatFiles.has(currentFileId)) {
                flatFiles.get(currentFileId).content = codeEditor.value;
            }

            currentFileId = id;
            codeEditor.value = file.content;
            fileNameDisplay.textContent = file.name;

            // Update Highlight
            document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
            // Re-render is expensive, better to just find element? 
            // For simplicity, let's just re-render tree to update active state visual
            renderExplorer();
        }

        codeEditor.addEventListener('input', () => {
            if(currentFileId && flatFiles.has(currentFileId)) {
                flatFiles.get(currentFileId).content = codeEditor.value;
            }
        });

        // --- 4. Content Generation ---
        function createContent(name, comment) {
            const ext = name.split('.').pop();
            const head = comment ? `\n` : '';
            
            if(ext === 'html') return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${name}</title>\n</head>\n<body>\n${head}<h1>${name}</h1>\n</body>\n</html>`;
            if(ext === 'css') return `/* ${name} - ${comment || 'Styles'} */\nbody {\n  margin: 0;\n  padding: 0;\n  font-family: sans-serif;\n}`;
            if(ext === 'js') return `// ${name}\n// ${comment}\nconsole.log('Loaded ${name}');`;
            
            return `// ${name}\n// ${comment}\n// Start coding here...`;
        }

        // --- 5. Utility Functions ---
        function toggleSidebar() {
            sidebar.classList.toggle('open');
            sidebarOverlay.classList.toggle('active');
        }

        function openModal() { setupModal.classList.add('active'); }
        function closeModal() { setupModal.classList.remove('active'); }

        function showLoader(title, isGenerating) {
            loadingOverlay.classList.add('active');
            loadingTitle.textContent = title;
            progressBar.style.width = '0%';
        }

        function hideLoader() {
            loadingOverlay.classList.remove('active');
        }

        function updateProgress(percent, text) {
            progressBar.style.width = `${percent}%`;
            loadingStatus.textContent = text;
        }
