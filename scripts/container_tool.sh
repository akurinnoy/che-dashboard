#!/bin/bash

# define if podman or docker is installed and running
define_container_tool() {
    local podman_installed=0
    # Check if Podman is installed
    if command -v podman &> /dev/null
    then
        echo "Podman is installed..."
        podman_installed=1

        # Check if Podman machine is running
        if [[ $(podman machine info --format "{{ .Host.MachineState }}") == "Running" ]]
        then
            echo "Podman machine is running..."
            echo "Use Podman as container tool"
            CONTAINER_TOOL="podman"
            return;
        else
            echo "Podman machine is not running..."
        fi
    fi

    local docker_installed=0
    if command -v docker &> /dev/null
    then
        echo "Docker is installed..."
        docker_installed=1

        # Check if Docker daemon is running
        if docker info &> /dev/null
        then
            echo "Docker daemon is running..."
            CONTAINER_TOOL="docker"
            return;
        else
            echo "Docker daemon is not running..."
        fi
    fi

    if [[ $podman_installed -eq 0 && $docker_installed -eq 0 ]]
    then
        echo "Neither Podman nor Docker is installed..."
        echo "Please install Podman or Docker to use this script."
    elif [[ $podman_installed -eq 1 ]]
    then
        echo "Please try 'podman machine init' and 'podman machine start' to manage a new Linux VM, and then try again."
    elif [[ $docker_installed -eq 1 ]]
    then
        echo "Docker daemon is not running."
    fi

    exit 1
}

# Run command using Docker or Podman whichever is available
container_tool() {
    local command=$1
    shift

    define_container_tool

    "$CONTAINER_TOOL" "$command" "$@"
}

# Main script
case "$1" in
    build|run|push)
        container_tool "$@"
        ;;
    *)
        echo "Uknown command. Use: build, run or push."
        exit 1
        ;;
esac

exit 0
